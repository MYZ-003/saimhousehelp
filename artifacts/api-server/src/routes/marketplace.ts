import { getAuth } from "@clerk/express";
import { Router, type Request, type RequestHandler, type Response } from "express";
import type {
  Conversation,
  HelperPreview,
  Message,
  MessageInput,
  Notification,
  Offer,
  OfferDecisionInput,
  OfferDecisionResult,
  Profile,
  ProfileInput,
  SwipeInput,
  SwipeResult,
} from "@workspace/api-zod";
import {
  getSupabasePool,
  type PoolClient,
  type SupabasePool,
} from "@workspace/db/supabase";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();
const MAX_VOICE_BYTES = 5 * 1024 * 1024;
const MAX_VOICE_BASE64_CHARS = 7_000_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ProfileRole = "client" | "helper";

interface ProfileRow {
  id: string;
  clerk_user_id: string;
  role: ProfileRole;
  full_name: string;
  language: "en" | "ur" | "romanUrdu";
  city: string;
  area: string;
  latitude: number | null;
  longitude: number | null;
  radius_km: number;
  skills: string[];
  work_types: string[];
  service_hours_min: number | null;
  service_hours_max: number | null;
  rate_min_pkr: number | null;
  rate_max_pkr: number | null;
  nature_of_work: string | null;
  about: string | null;
  verification_status: "unverified" | "pending" | "verified" | "rejected";
  created_at: Date;
}

interface OfferRow {
  id: string;
  client_profile_id: string;
  helper_profile_id: string;
  client_user_id?: string;
  helper_user_id?: string;
  client_name?: string;
  helper_name?: string;
  amount_pkr: number;
  counter_amount_pkr: number | null;
  duration_hours: number | string;
  work_type: string;
  work_description: string;
  status: "pending" | "accepted" | "declined" | "countered";
  created_at: Date;
  conversation_id: string | null;
}

interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  offer_id: string | null;
  conversation_id: string | null;
  read: boolean;
  created_at: Date;
}

interface ConversationRow {
  id: string;
  other_user_id: string;
  other_name: string;
  last_message: string | null;
  last_message_at: Date | null;
  unread_count: number | string;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  text: string | null;
  voice_data: Buffer | null;
  voice_mime_type: string | null;
  duration_seconds: number | string | null;
  created_at: Date;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pathParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return Number.isInteger(value) && isNumber(value) && value >= minimum && value <= maximum;
}

function isNullableNumber(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number | null {
  return value === null || (isNumber(value) && value >= minimum && value <= maximum);
}

function isNullableInteger(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number | null {
  return value === null || isIntegerInRange(value, minimum, maximum);
}

function isStringList(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    value.every(
      (item) =>
        typeof item === "string" &&
        item.trim().length > 0 &&
        item.trim().length <= maxLength,
    )
  );
}

function nullableTextIsValid(value: unknown, maxLength: number): value is string | null {
  return value === null || (typeof value === "string" && value.length <= maxLength);
}

function normalizeProfileInput(value: unknown): ProfileInput | null {
  if (!isRecord(value)) return null;

  const {
    role,
    fullName,
    language,
    city,
    area,
    latitude,
    longitude,
    radiusKm,
    skills,
    workTypes,
    serviceHoursMin,
    serviceHoursMax,
    rateMinPkr,
    rateMaxPkr,
    natureOfWork,
    about,
  } = value;

  if (role !== "client" && role !== "helper") return null;
  if (language !== "en" && language !== "ur" && language !== "romanUrdu") return null;
  if (typeof fullName !== "string" || fullName.trim().length < 2 || fullName.trim().length > 100) return null;
  if (typeof city !== "string" || city.trim().length < 2 || city.trim().length > 80) return null;
  if (typeof area !== "string" || area.trim().length < 2 || area.trim().length > 100) return null;
  if (!isNullableNumber(latitude, -90, 90) || !isNullableNumber(longitude, -180, 180)) return null;
  if ((latitude === null) !== (longitude === null)) return null;
  if (!isIntegerInRange(radiusKm, 1, 100)) return null;
  if (!isStringList(skills, 12, 60) || !isStringList(workTypes, 12, 60)) return null;
  if (!isNullableInteger(serviceHoursMin, 1, 24) || !isNullableInteger(serviceHoursMax, 1, 24)) return null;
  if ((serviceHoursMin === null) !== (serviceHoursMax === null)) return null;
  if (serviceHoursMin !== null && serviceHoursMax !== null && serviceHoursMin > serviceHoursMax) return null;
  if (!isNullableInteger(rateMinPkr, 0, 1_000_000) || !isNullableInteger(rateMaxPkr, 0, 1_000_000)) return null;
  if (rateMinPkr !== null && rateMaxPkr !== null && rateMinPkr > rateMaxPkr) return null;
  if (!nullableTextIsValid(natureOfWork, 300) || !nullableTextIsValid(about, 800)) return null;

  return {
    role,
    fullName: fullName.trim(),
    language,
    city: city.trim(),
    area: area.trim(),
    latitude,
    longitude,
    radiusKm,
    skills: skills.map((item) => item.trim()),
    workTypes: workTypes.map((item) => item.trim()),
    serviceHoursMin,
    serviceHoursMax,
    rateMinPkr,
    rateMaxPkr,
    natureOfWork: natureOfWork?.trim() ?? null,
    about: about?.trim() ?? null,
  };
}

function normalizeSwipeInput(value: unknown): SwipeInput | null {
  if (!isRecord(value)) return null;
  const { helperId, direction, offerAmountPkr, workType, durationHours, workDescription } = value;

  if (typeof helperId !== "string" || !UUID_PATTERN.test(helperId)) return null;
  if (direction !== "left" && direction !== "right") return null;
  if (!isNullableInteger(offerAmountPkr, 0, 1_000_000)) return null;
  if (typeof workType !== "string" || workType.trim().length === 0 || workType.trim().length > 60) return null;
  if (!isNumber(durationHours) || durationHours < 0.5 || durationHours > 24) return null;
  if (typeof workDescription !== "string" || workDescription.length > 500) return null;
  if (direction === "right" && (!offerAmountPkr || offerAmountPkr < 1)) return null;
  if (direction === "left" && offerAmountPkr !== null && offerAmountPkr !== 0) return null;

  return {
    helperId,
    direction,
    offerAmountPkr,
    workType: workType.trim(),
    durationHours,
    workDescription: workDescription.trim(),
  };
}

function normalizeOfferDecision(value: unknown): OfferDecisionInput | null {
  if (!isRecord(value)) return null;
  const { action, counterAmountPkr } = value;
  if (action !== "accept" && action !== "decline" && action !== "counter") return null;
  if (
    counterAmountPkr !== undefined &&
    !isIntegerInRange(counterAmountPkr, 0, 1_000_000)
  ) {
    return null;
  }
  if (action === "counter" && counterAmountPkr === undefined) return null;
  return {
    action,
    ...(counterAmountPkr === undefined ? {} : { counterAmountPkr }),
  };
}

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/aac",
  "audio/3gpp",
  "audio/m4a",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a",
]);

function normalizeMessageInput(value: unknown): {
  input: MessageInput;
  audio: Buffer | null;
} | null {
  if (!isRecord(value)) return null;
  const { text, voiceBase64, voiceMimeType, durationSeconds } = value;

  if (!(text === null || (typeof text === "string" && text.length <= 2000))) return null;
  if (!(voiceBase64 === null || (typeof voiceBase64 === "string" && voiceBase64.length <= MAX_VOICE_BASE64_CHARS))) return null;
  if (!(voiceMimeType === null || (typeof voiceMimeType === "string" && voiceMimeType.length <= 100))) return null;
  if (!(durationSeconds === null || (isNumber(durationSeconds) && durationSeconds >= 0 && durationSeconds <= 60))) return null;

  const hasText = typeof text === "string" && text.trim().length > 0;
  const hasVoice = typeof voiceBase64 === "string" && voiceBase64.length > 0;
  if (hasText === hasVoice) return null;

  if (hasText) {
    if (voiceMimeType !== null || durationSeconds !== null) return null;
    return {
      input: { text: (text as string).trim(), voiceBase64: null, voiceMimeType: null, durationSeconds: null },
      audio: null,
    };
  }

  if (
    typeof voiceBase64 !== "string" ||
    typeof voiceMimeType !== "string" ||
    !ALLOWED_AUDIO_MIME_TYPES.has(voiceMimeType.toLowerCase()) ||
    !isNumber(durationSeconds) ||
    durationSeconds < 0.01
  ) {
    return null;
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(voiceBase64) || voiceBase64.length % 4 === 1) return null;
  const audio = Buffer.from(voiceBase64, "base64");
  if (
    audio.length === 0 ||
    audio.length > MAX_VOICE_BYTES ||
    audio.toString("base64").replace(/=+$/, "") !== voiceBase64.replace(/=+$/, "")
  ) {
    return null;
  }

  return {
    input: {
      text: null,
      voiceBase64,
      voiceMimeType: voiceMimeType.toLowerCase(),
      durationSeconds,
    },
    audio,
  };
}

function profileFromRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    role: row.role,
    fullName: row.full_name,
    language: row.language,
    city: row.city,
    area: row.area,
    latitude: row.latitude === null ? null : Number(row.latitude),
    longitude: row.longitude === null ? null : Number(row.longitude),
    radiusKm: row.radius_km,
    skills: row.skills ?? [],
    workTypes: row.work_types ?? [],
    serviceHoursMin: row.service_hours_min,
    serviceHoursMax: row.service_hours_max,
    rateMinPkr: row.rate_min_pkr,
    rateMaxPkr: row.rate_max_pkr,
    natureOfWork: row.nature_of_work,
    about: row.about,
    verificationStatus: row.verification_status,
    createdAt: row.created_at,
  };
}

function offerFromRow(row: OfferRow, userId: string): Offer {
  const isClient = row.client_user_id === userId;
  return {
    id: row.id,
    otherUserId: isClient ? row.helper_profile_id : row.client_profile_id,
    otherName: isClient ? row.helper_name! : row.client_name!,
    myRole: isClient ? "client" : "helper",
    amountPkr: row.amount_pkr,
    counterAmountPkr: row.counter_amount_pkr,
    durationHours: Number(row.duration_hours),
    workType: row.work_type,
    workDescription: row.work_description,
    status: row.status,
    createdAt: row.created_at,
    conversationId: row.conversation_id,
  };
}

function notificationFromRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    offerId: row.offer_id,
    conversationId: row.conversation_id,
    read: row.read,
    createdAt: row.created_at,
  };
}

function conversationFromRow(row: ConversationRow): Conversation {
  return {
    id: row.id,
    otherUserId: row.other_user_id,
    otherName: row.other_name,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
    unreadCount: Number(row.unread_count),
  };
}

function messageFromRow(row: MessageRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_profile_id,
    text: row.text,
    voiceBase64: row.voice_data ? row.voice_data.toString("base64") : null,
    voiceMimeType: row.voice_mime_type,
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
    createdAt: row.created_at,
  };
}

async function transaction<T>(
  pool: SupabasePool,
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

type DbHandler = (req: Request, res: Response, pool: SupabasePool) => Promise<void>;

function databaseRoute(handler: DbHandler): RequestHandler {
  return async (req, res, next): Promise<void> => {
    const pool = getSupabasePool();
    if (!pool) {
      res.status(503).json({
        error: "Marketplace database is not configured. Set the server-only SUPABASE_DATABASE_URL environment variable.",
      });
      return;
    }

    try {
      await handler(req, res, pool);
    } catch (error) {
      if (res.headersSent) {
        next(error);
        return;
      }
      if (error instanceof HttpError) {
        res.status(error.status).json({ error: error.message });
        return;
      }

      // Deliberately do not log connection details or environment values.
      res.status(503).json({
        error: "Marketplace database is unavailable. Confirm its migration has been applied and the connection is reachable.",
      });
    }
  };
}

async function findMyProfile(pool: SupabasePool, userId: string): Promise<ProfileRow | null> {
  const result = await pool.query<ProfileRow>(
    "SELECT * FROM public.profiles WHERE clerk_user_id = $1 LIMIT 1",
    [userId],
  );
  return result.rows[0] ?? null;
}

function currentUserId(req: Request): string {
  const userId = getAuth(req).userId;
  if (!userId) throw new HttpError(401, "Sign-in is required.");
  return userId;
}

router.use(requireAuth);

router.get(
  "/me",
  databaseRoute(async (req, res, pool) => {
    const row = await findMyProfile(pool, currentUserId(req));
    res.json({ profile: row ? profileFromRow(row) : null });
  }),
);

router.put(
  "/me",
  databaseRoute(async (req, res, pool) => {
    const input = normalizeProfileInput(req.body);
    if (!input) throw new HttpError(400, "Profile details are invalid.");
    const userId = currentUserId(req);
    const result = await pool.query<ProfileRow>(
      `INSERT INTO public.profiles (
         clerk_user_id, role, full_name, language, city, area, latitude, longitude,
         radius_km, skills, work_types, service_hours_min, service_hours_max,
         rate_min_pkr, rate_max_pkr, nature_of_work, about
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], $11::text[],
         $12, $13, $14, $15, $16, $17
       )
       ON CONFLICT (clerk_user_id) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         language = EXCLUDED.language,
         city = EXCLUDED.city,
         area = EXCLUDED.area,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         radius_km = EXCLUDED.radius_km,
         skills = EXCLUDED.skills,
         work_types = EXCLUDED.work_types,
         service_hours_min = EXCLUDED.service_hours_min,
         service_hours_max = EXCLUDED.service_hours_max,
         rate_min_pkr = EXCLUDED.rate_min_pkr,
         rate_max_pkr = EXCLUDED.rate_max_pkr,
         nature_of_work = EXCLUDED.nature_of_work,
         about = EXCLUDED.about,
         updated_at = now()
       WHERE public.profiles.role = EXCLUDED.role
       RETURNING *`,
      [
        userId,
        input.role,
        input.fullName,
        input.language,
        input.city,
        input.area,
        input.latitude,
        input.longitude,
        input.radiusKm,
        input.skills,
        input.workTypes,
        input.serviceHoursMin,
        input.serviceHoursMax,
        input.rateMinPkr,
        input.rateMaxPkr,
        input.natureOfWork,
        input.about,
      ],
    );

    if (!result.rows[0]) {
      throw new HttpError(409, "Your account role cannot be changed after profile setup.");
    }
    res.json({ profile: profileFromRow(result.rows[0]) });
  }),
);

router.delete(
  "/me",
  databaseRoute(async (req, res, pool) => {
    await pool.query("DELETE FROM public.profiles WHERE clerk_user_id = $1", [
      currentUserId(req),
    ]);
    res.status(204).end();
  }),
);

router.get(
  "/helpers",
  databaseRoute(async (req, res, pool) => {
    const userId = currentUserId(req);
    const client = await findMyProfile(pool, userId);
    if (!client || client.role !== "client") {
      throw new HttpError(403, "Only clients can discover nearby helpers.");
    }
    if (client.latitude === null || client.longitude === null) {
      res.json([]);
      return;
    }

    const radiusValue = req.query.radiusKm;
    let radius = client.radius_km;
    if (radiusValue !== undefined) {
      if (typeof radiusValue !== "string" || radiusValue.trim() === "") {
        throw new HttpError(400, "Search radius must be a number from 1 to 100 km.");
      }
      radius = Number(radiusValue);
      if (!Number.isFinite(radius) || radius < 1 || radius > 100) {
        throw new HttpError(400, "Search radius must be a number from 1 to 100 km.");
      }
    }

    let workType: string | null = null;
    if (req.query.workType !== undefined) {
      if (typeof req.query.workType !== "string" || req.query.workType.trim().length > 60) {
        throw new HttpError(400, "Work type must be 60 characters or fewer.");
      }
      workType = req.query.workType.trim() || null;
    }

    const result = await pool.query<{
      id: string;
      full_name: string;
      city: string;
      area: string;
      distance_km: number | string;
      skills: string[];
      work_types: string[];
      service_hours_min: number | null;
      service_hours_max: number | null;
      rate_min_pkr: number | null;
      rate_max_pkr: number | null;
      nature_of_work: string | null;
      about: string | null;
      verification_status: HelperPreview["verificationStatus"];
    }>(
      `WITH nearby AS (
         SELECT
           id, full_name, city, area, skills, work_types,
           service_hours_min, service_hours_max, rate_min_pkr, rate_max_pkr,
           nature_of_work, about, verification_status,
           6371.0088 * acos(LEAST(1.0, GREATEST(-1.0,
             cos(radians($1::double precision)) * cos(radians(latitude)) *
             cos(radians(longitude) - radians($2::double precision)) +
             sin(radians($1::double precision)) * sin(radians(latitude))
           ))) AS distance_km
         FROM public.profiles
          WHERE role = 'helper'
            AND verification_status <> 'rejected'
           AND latitude IS NOT NULL
           AND longitude IS NOT NULL
           AND clerk_user_id <> $5
       )
       SELECT id, full_name, city, area,
         round(distance_km::numeric, 1) AS distance_km,
         skills, work_types, service_hours_min, service_hours_max,
         rate_min_pkr, rate_max_pkr, nature_of_work, about, verification_status
       FROM nearby
       WHERE distance_km <= $3
         AND ($4::text IS NULL OR $4 = ANY(work_types) OR $4 = ANY(skills))
       ORDER BY distance_km, id
       LIMIT 100`,
      [client.latitude, client.longitude, radius, workType, userId],
    );

    const helpers: HelperPreview[] = result.rows.map((row) => ({
      id: row.id,
      fullName: row.full_name,
      city: row.city,
      area: row.area,
      distanceKm: Number(row.distance_km),
      skills: row.skills ?? [],
      workTypes: row.work_types ?? [],
      serviceHoursMin: row.service_hours_min,
      serviceHoursMax: row.service_hours_max,
      rateMinPkr: row.rate_min_pkr,
      rateMaxPkr: row.rate_max_pkr,
      natureOfWork: row.nature_of_work,
      about: row.about,
      verificationStatus: row.verification_status,
    }));
    res.json(helpers);
  }),
);

router.post(
  "/swipes",
  databaseRoute(async (req, res, pool) => {
    const input = normalizeSwipeInput(req.body);
    if (!input) throw new HttpError(400, "Swipe or offer details are invalid.");

    const userId = currentUserId(req);
    const client = await findMyProfile(pool, userId);
    if (!client || client.role !== "client") {
      throw new HttpError(403, "Only clients can send helper offers.");
    }

    if (input.direction === "right" && input.offerAmountPkr === null) {
      throw new HttpError(400, "A right swipe must include a positive PKR offer.");
    }

    const outcome = await transaction(pool, async (tx) => {
      const helperResult = await tx.query<{
        id: string;
        clerk_user_id: string;
        full_name: string;
      }>(
        `SELECT id, clerk_user_id, full_name
         FROM public.profiles
         WHERE id = $1 AND role = 'helper'
           AND verification_status <> 'rejected'
           AND latitude IS NOT NULL AND longitude IS NOT NULL
           AND (
             6371.0088 * acos(LEAST(1.0, GREATEST(-1.0,
               cos(radians($2::double precision)) * cos(radians(latitude)) *
               cos(radians(longitude) - radians($3::double precision)) +
               sin(radians($2::double precision)) * sin(radians(latitude))
             )))
           ) <= $4
           AND ($5 = ANY(work_types) OR $5 = ANY(skills))`,
        [
          input.helperId,
          client.latitude,
          client.longitude,
          client.radius_km,
          input.workType,
        ],
      );
      const helper = helperResult.rows[0];
      if (!helper) {
        throw new HttpError(404, "This helper is unavailable for the selected work type or search area.");
      }

      const swipeResult = await tx.query<{ id: string }>(
        `INSERT INTO public.swipes (client_profile_id, helper_profile_id, direction)
         VALUES ($1, $2, $3)
         ON CONFLICT (client_profile_id, helper_profile_id)
          DO UPDATE SET
            direction = CASE
              WHEN public.swipes.direction = 'right' THEN 'right'
              ELSE EXCLUDED.direction
            END,
            updated_at = now()
         RETURNING id`,
        [client.id, helper.id, input.direction],
      );
      const swipeId = swipeResult.rows[0]!.id;

      if (input.direction === "left") {
        return { offerId: null, helperNotified: false };
      }

      const currentOffer = await tx.query<{
        id: string;
        amount_pkr: number;
        duration_hours: number | string;
        work_type: string;
        work_description: string;
        status: OfferRow["status"];
      }>(
        `SELECT id, amount_pkr, duration_hours, work_type, work_description, status
         FROM public.offers WHERE swipe_id = $1 FOR UPDATE`,
        [swipeId],
      );
      let offerId: string;
      let shouldNotify = true;
      const existing = currentOffer.rows[0];

      if (existing?.status === "accepted") {
        throw new HttpError(409, "An accepted offer already has a conversation.");
      }

      if (
        existing?.status === "pending" &&
        existing.amount_pkr === input.offerAmountPkr &&
        Number(existing.duration_hours) === input.durationHours &&
        existing.work_type === input.workType &&
        existing.work_description === input.workDescription
      ) {
        offerId = existing.id;
        shouldNotify = false;
      } else if (existing) {
        const updated = await tx.query<{ id: string }>(
          `UPDATE public.offers
           SET amount_pkr = $2, counter_amount_pkr = NULL, duration_hours = $3,
               work_type = $4, work_description = $5, status = 'pending', updated_at = now()
           WHERE id = $1
           RETURNING id`,
          [
            existing.id,
            input.offerAmountPkr,
            input.durationHours,
            input.workType,
            input.workDescription,
          ],
        );
        offerId = updated.rows[0]!.id;
      } else {
        const inserted = await tx.query<{ id: string }>(
          `INSERT INTO public.offers (
             swipe_id, client_profile_id, helper_profile_id, amount_pkr,
             duration_hours, work_type, work_description
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            swipeId,
            client.id,
            helper.id,
            input.offerAmountPkr,
            input.durationHours,
            input.workType,
            input.workDescription,
          ],
        );
        offerId = inserted.rows[0]!.id;
      }

      if (shouldNotify) {
        await tx.query(
          `INSERT INTO public.notifications (
             recipient_profile_id, kind, title, body, offer_id
           ) VALUES ($1, 'offer_received', 'A client sent you an offer', $2, $3)`,
          [
            helper.id,
            `${client.full_name} offered ₨ ${input.offerAmountPkr} for ${input.workType}.`,
            offerId,
          ],
        );
      }

      return { offerId, helperNotified: true };
    });

    const body: SwipeResult = { recorded: true, ...outcome };
    res.status(201).json(body);
  }),
);

router.get(
  "/offers",
  databaseRoute(async (req, res, pool) => {
    const userId = currentUserId(req);
    const profile = await findMyProfile(pool, userId);
    if (!profile) {
      res.json([]);
      return;
    }

    const result = await pool.query<OfferRow>(
      `SELECT
         o.id, o.client_profile_id, o.helper_profile_id,
         client.clerk_user_id AS client_user_id,
         client.full_name AS client_name, helper.full_name AS helper_name,
         o.amount_pkr, o.counter_amount_pkr, o.duration_hours, o.work_type,
         o.work_description, o.status, o.created_at, conversation.id AS conversation_id
       FROM public.offers o
       JOIN public.profiles client ON client.id = o.client_profile_id
       JOIN public.profiles helper ON helper.id = o.helper_profile_id
       LEFT JOIN public.conversations conversation ON conversation.offer_id = o.id
       WHERE o.client_profile_id = $1 OR o.helper_profile_id = $1
       ORDER BY o.created_at DESC
       LIMIT 200`,
      [profile.id],
    );
    res.json(result.rows.map((row) => offerFromRow(row, userId)));
  }),
);

router.patch(
  "/offers/:offerId",
  databaseRoute(async (req, res, pool) => {
    const input = normalizeOfferDecision(req.body);
    if (!input) throw new HttpError(400, "Offer decision is invalid.");
    const offerId = pathParam(req.params.offerId);
    if (!UUID_PATTERN.test(offerId)) {
      throw new HttpError(404, "Offer not found.");
    }
    const userId = currentUserId(req);

    const response = await transaction(pool, async (tx) => {
      const result = await tx.query<OfferRow>(
        `SELECT
           o.id, o.client_profile_id, o.helper_profile_id,
           client.clerk_user_id AS client_user_id,
           helper.clerk_user_id AS helper_user_id,
           client.full_name AS client_name, helper.full_name AS helper_name,
           o.amount_pkr, o.counter_amount_pkr, o.duration_hours, o.work_type,
           o.work_description, o.status, o.created_at, conversation.id AS conversation_id
         FROM public.offers o
         JOIN public.profiles client ON client.id = o.client_profile_id
         JOIN public.profiles helper ON helper.id = o.helper_profile_id
         LEFT JOIN public.conversations conversation ON conversation.offer_id = o.id
         WHERE o.id = $1
         FOR UPDATE OF o`,
        [offerId],
      );
      const offer = result.rows[0];
      if (!offer || (offer.client_user_id !== userId && offer.helper_user_id !== userId)) {
        throw new HttpError(404, "Offer not found.");
      }

      const isHelper = offer.helper_user_id === userId;
      const helperResponding = isHelper && offer.status === "pending";
      const clientResponding = !isHelper && offer.status === "countered";
      if (!helperResponding && !clientResponding) {
        throw new HttpError(400, "This offer is no longer awaiting a response from you.");
      }
      if (clientResponding && input.action === "counter") {
        throw new HttpError(400, "Only helpers can counter a pending offer.");
      }

      let nextStatus: OfferRow["status"];
      if (input.action === "counter") {
        if (!helperResponding || input.counterAmountPkr === undefined) {
          throw new HttpError(400, "A helper counter offer must include a PKR amount.");
        }
        nextStatus = "countered";
      } else if (input.action === "accept") {
        nextStatus = "accepted";
      } else {
        nextStatus = "declined";
      }

      const updated = await tx.query(
        `UPDATE public.offers
         SET status = $2,
             counter_amount_pkr = $3,
             updated_at = now()
         WHERE id = $1`,
        [
          offer.id,
          nextStatus,
          input.action === "counter" ? input.counterAmountPkr : offer.counter_amount_pkr,
        ],
      );
      void updated;

      let conversationId = offer.conversation_id;
      if (nextStatus === "accepted") {
        await tx.query(
          `INSERT INTO public.conversations (offer_id, client_profile_id, helper_profile_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (offer_id) DO NOTHING`,
          [offer.id, offer.client_profile_id, offer.helper_profile_id],
        );
        const conversation = await tx.query<{ id: string }>(
          "SELECT id FROM public.conversations WHERE offer_id = $1",
          [offer.id],
        );
        conversationId = conversation.rows[0]!.id;
      }

      const recipientProfileId = input.action === "counter"
        ? offer.client_profile_id
        : isHelper
          ? offer.client_profile_id
          : offer.helper_profile_id;
      const title = input.action === "counter"
        ? "A helper sent a counter offer"
        : input.action === "accept"
          ? "Your offer was accepted"
          : "An offer was declined";
      const body = input.action === "counter"
        ? `The counter offer is ₨ ${input.counterAmountPkr} for ${offer.work_type}.`
        : `${offer.work_type} offer update: ${nextStatus}.`;
      await tx.query(
        `INSERT INTO public.notifications (
           recipient_profile_id, kind, title, body, offer_id, conversation_id
         ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          recipientProfileId,
          input.action === "counter" ? "offer_countered" : `offer_${nextStatus}`,
          title,
          body,
          offer.id,
          conversationId,
        ],
      );

      const refreshed = await tx.query<OfferRow>(
        `SELECT
           o.id, o.client_profile_id, o.helper_profile_id,
           client.clerk_user_id AS client_user_id,
           helper.clerk_user_id AS helper_user_id,
           client.full_name AS client_name, helper.full_name AS helper_name,
           o.amount_pkr, o.counter_amount_pkr, o.duration_hours, o.work_type,
           o.work_description, o.status, o.created_at, conversation.id AS conversation_id
         FROM public.offers o
         JOIN public.profiles client ON client.id = o.client_profile_id
         JOIN public.profiles helper ON helper.id = o.helper_profile_id
         LEFT JOIN public.conversations conversation ON conversation.offer_id = o.id
         WHERE o.id = $1`,
        [offer.id],
      );
      return {
        offer: offerFromRow(refreshed.rows[0]!, userId),
        conversationId,
      };
    });

    const body: OfferDecisionResult = response;
    res.json(body);
  }),
);

router.get(
  "/notifications",
  databaseRoute(async (req, res, pool) => {
    const profile = await findMyProfile(pool, currentUserId(req));
    if (!profile) {
      res.json([]);
      return;
    }

    const result = await pool.query<NotificationRow>(
      `SELECT id, kind, title, body, offer_id, conversation_id,
         (read_at IS NOT NULL) AS read, created_at
       FROM public.notifications
       WHERE recipient_profile_id = $1
       ORDER BY created_at DESC
       LIMIT 200`,
      [profile.id],
    );
    res.json(result.rows.map(notificationFromRow));
  }),
);

router.patch(
  "/notifications/:notificationId/read",
  databaseRoute(async (req, res, pool) => {
    const notificationId = pathParam(req.params.notificationId);
    if (!UUID_PATTERN.test(notificationId)) {
      throw new HttpError(404, "Notification not found.");
    }
    const profile = await findMyProfile(pool, currentUserId(req));
    if (!profile) throw new HttpError(404, "Notification not found.");

    const result = await pool.query(
      `UPDATE public.notifications
       SET read_at = COALESCE(read_at, now())
       WHERE id = $1 AND recipient_profile_id = $2`,
      [notificationId, profile.id],
    );
    if (result.rowCount === 0) throw new HttpError(404, "Notification not found.");
    res.status(204).end();
  }),
);

router.get(
  "/conversations",
  databaseRoute(async (req, res, pool) => {
    const profile = await findMyProfile(pool, currentUserId(req));
    if (!profile) {
      res.json([]);
      return;
    }

    const result = await pool.query<ConversationRow>(
      `SELECT
         c.id,
         other.id AS other_user_id,
         other.full_name AS other_name,
         latest.last_message,
         latest.last_message_at,
         (
           SELECT count(*)::integer
           FROM public.messages unread
           WHERE unread.conversation_id = c.id
             AND unread.sender_profile_id <> $1
             AND unread.read_at IS NULL
         ) AS unread_count
       FROM public.conversations c
       JOIN public.profiles other
         ON other.id = CASE
           WHEN c.client_profile_id = $1 THEN c.helper_profile_id
           ELSE c.client_profile_id
         END
       LEFT JOIN LATERAL (
         SELECT
           COALESCE(m.text, CASE WHEN m.voice_data IS NOT NULL THEN 'Voice message' END) AS last_message,
           m.created_at AS last_message_at
         FROM public.messages m
         WHERE m.conversation_id = c.id
         ORDER BY m.created_at DESC
         LIMIT 1
       ) latest ON true
       WHERE c.client_profile_id = $1 OR c.helper_profile_id = $1
       ORDER BY COALESCE(latest.last_message_at, c.created_at) DESC
       LIMIT 200`,
      [profile.id],
    );
    res.json(result.rows.map(conversationFromRow));
  }),
);

router.get(
  "/conversations/:conversationId/messages",
  databaseRoute(async (req, res, pool) => {
    const conversationId = pathParam(req.params.conversationId);
    if (!UUID_PATTERN.test(conversationId)) {
      throw new HttpError(404, "Conversation not found.");
    }
    const profile = await findMyProfile(pool, currentUserId(req));
    if (!profile) throw new HttpError(404, "Conversation not found.");

    const messages = await transaction(pool, async (tx) => {
      const membership = await tx.query<{ id: string }>(
        `SELECT id FROM public.conversations
         WHERE id = $1 AND (client_profile_id = $2 OR helper_profile_id = $2)
         FOR UPDATE`,
        [conversationId, profile.id],
      );
      if (!membership.rows[0]) throw new HttpError(404, "Conversation not found.");

      await tx.query(
        `UPDATE public.messages
         SET read_at = COALESCE(read_at, now())
         WHERE conversation_id = $1 AND sender_profile_id <> $2 AND read_at IS NULL`,
        [conversationId, profile.id],
      );
      const result = await tx.query<MessageRow>(
        `SELECT
           m.id, m.conversation_id, m.sender_profile_id,
           m.text, m.voice_data, m.voice_mime_type, m.duration_seconds, m.created_at
         FROM (
           SELECT * FROM public.messages
           WHERE conversation_id = $1
           ORDER BY created_at DESC
           LIMIT 20
         ) m
         ORDER BY m.created_at ASC`,
        [conversationId],
      );
      return result.rows;
    });

    res.json(messages.map(messageFromRow));
  }),
);

router.post(
  "/conversations/:conversationId/messages",
  databaseRoute(async (req, res, pool) => {
    const conversationId = pathParam(req.params.conversationId);
    if (!UUID_PATTERN.test(conversationId)) {
      throw new HttpError(404, "Conversation not found.");
    }
    const normalized = normalizeMessageInput(req.body);
    if (!normalized) {
      throw new HttpError(400, "Send either a text message or a valid voice message of at most 60 seconds.");
    }

    const profile = await findMyProfile(pool, currentUserId(req));
    if (!profile) throw new HttpError(404, "Conversation not found.");

    const message = await transaction(pool, async (tx) => {
      const membership = await tx.query<{
        id: string;
        client_profile_id: string;
        helper_profile_id: string;
      }>(
        `SELECT id, client_profile_id, helper_profile_id
         FROM public.conversations
         WHERE id = $1 AND (client_profile_id = $2 OR helper_profile_id = $2)
         FOR UPDATE`,
        [conversationId, profile.id],
      );
      const conversation = membership.rows[0];
      if (!conversation) throw new HttpError(404, "Conversation not found.");

      const inserted = await tx.query<MessageRow>(
        `INSERT INTO public.messages (
           conversation_id, sender_profile_id, text, voice_data,
           voice_mime_type, duration_seconds
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING
           id, conversation_id, sender_profile_id, text, voice_data,
           voice_mime_type, duration_seconds, created_at`,
        [
          conversation.id,
          profile.id,
          normalized.input.text,
          normalized.audio,
          normalized.input.voiceMimeType,
          normalized.input.durationSeconds,
        ],
      );
      await tx.query(
        "UPDATE public.conversations SET updated_at = now() WHERE id = $1",
        [conversation.id],
      );

      const recipientProfileId =
        conversation.client_profile_id === profile.id
          ? conversation.helper_profile_id
          : conversation.client_profile_id;
      await tx.query(
        `INSERT INTO public.notifications (
           recipient_profile_id, kind, title, body, conversation_id
         ) VALUES ($1, 'message_received', 'New message', $2, $3)`,
        [
          recipientProfileId,
          normalized.audio ? "You received a voice message." : "You received a new message.",
          conversation.id,
        ],
      );

      const result = await tx.query<MessageRow>(
        `SELECT
           m.id, m.conversation_id, m.sender_profile_id,
           m.text, m.voice_data, m.voice_mime_type, m.duration_seconds, m.created_at
         FROM public.messages m
         WHERE m.id = $1`,
        [inserted.rows[0]!.id],
      );
      return result.rows[0]!;
    });

    res.status(201).json(messageFromRow(message));
  }),
);

export default router;