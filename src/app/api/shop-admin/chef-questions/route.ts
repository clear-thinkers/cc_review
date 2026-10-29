import { NextRequest, NextResponse } from "next/server";
import { getJwtAppMetadataUserId } from "@/lib/decodeJwtPayload";
import { normalizeChefChallengeQuestionDraft, validateChefChallengeQuestionDraft } from "@/lib/pawPrints";
import type {
  ChefChallengeQuestion,
  ChefChallengeQuestionDraft,
  ChefChallengeQuestionsResponse,
} from "@/lib/pawPrints.types";
import { getServerSupabaseClient, supabase } from "@/lib/supabaseClient";

/**
 * Shop Admin's chef-challenge question bank (roadmap item T; spec
 * docs/feature-specs/2026-10-28-chef-challenge-paw-prints.md, section D).
 *
 * Platform admin only. Children can't read `chef_challenge_questions` at all (RLS), so
 * every read and write goes through here with the service-role client. Every response
 * returns the recipe's full, current question list so the editor never goes stale.
 *
 *   GET    ?recipeId=…          → that recipe's questions
 *   POST   { draft }            → create (appended to the end)
 *   PATCH  { id, draft }        → edit or activate/deactivate
 *   DELETE ?id=…&recipeId=…     → delete
 */

type ServiceClient = ReturnType<typeof getServerSupabaseClient>;

interface QuestionRow {
  id: string;
  recipe_id: string;
  prompt: string;
  correct_answer: string;
  wrong_answers: unknown;
  explanation: string | null;
  is_active: boolean;
  display_order: number;
}

function toQuestion(row: QuestionRow): ChefChallengeQuestion {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    prompt: row.prompt,
    correctAnswer: row.correct_answer,
    wrongAnswers: Array.isArray(row.wrong_answers)
      ? row.wrong_answers.filter((answer): answer is string => typeof answer === "string")
      : [],
    explanation: row.explanation,
    isActive: row.is_active,
    displayOrder: row.display_order,
  };
}

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

async function authorizePlatformAdmin(
  request: NextRequest
): Promise<{ adminClient: ServiceClient | null; error: NextResponse | null }> {
  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { adminClient: null, error: errorResponse("Missing Authorization header.", 401) };

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user) return { adminClient: null, error: errorResponse("Invalid or expired session.", 401) };

  // The active profile from THIS token's own claims (not user.app_metadata, which is the
  // stale auth.users row -- see AI_CONTRACT.md §1, Auth / Session Claims).
  const userId = getJwtAppMetadataUserId(token);
  if (!userId) return { adminClient: null, error: errorResponse("Profile session not established.", 403) };

  let adminClient: ServiceClient;
  try {
    adminClient = getServerSupabaseClient();
  } catch {
    return { adminClient: null, error: errorResponse("Server configuration error.", 500) };
  }

  const { data: profileRow, error: profileError } = await adminClient
    .from("users")
    .select("id, is_platform_admin")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profileRow || profileRow.is_platform_admin !== true) {
    return { adminClient: null, error: errorResponse("Platform admin access is required.", 403) };
  }

  return { adminClient, error: null };
}

async function listForRecipe(adminClient: ServiceClient, recipeId: string): Promise<NextResponse> {
  const { data, error } = await adminClient
    .from("chef_challenge_questions")
    .select("id, recipe_id, prompt, correct_answer, wrong_answers, explanation, is_active, display_order")
    .eq("recipe_id", recipeId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return errorResponse("Could not load chef challenge questions.", 500);
  const response: ChefChallengeQuestionsResponse = { questions: ((data ?? []) as QuestionRow[]).map(toQuestion) };
  return NextResponse.json(response);
}

async function readValidatedDraft(
  request: NextRequest
): Promise<{ id: string | null; draft: ChefChallengeQuestionDraft | null; error: NextResponse | null }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { id: null, draft: null, error: errorResponse("Invalid request body.", 400) };
  }
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const draftBody = body.draft && typeof body.draft === "object" ? (body.draft as Record<string, unknown>) : {};
  const draft = normalizeChefChallengeQuestionDraft({
    recipeId: typeof draftBody.recipeId === "string" ? draftBody.recipeId : "",
    prompt: typeof draftBody.prompt === "string" ? draftBody.prompt : "",
    correctAnswer: typeof draftBody.correctAnswer === "string" ? draftBody.correctAnswer : "",
    wrongAnswers: Array.isArray(draftBody.wrongAnswers)
      ? draftBody.wrongAnswers.filter((answer): answer is string => typeof answer === "string")
      : [],
    explanation: typeof draftBody.explanation === "string" ? draftBody.explanation : "",
    isActive: draftBody.isActive !== false,
  });
  const problem = validateChefChallengeQuestionDraft(draft);
  if (problem) return { id: null, draft: null, error: NextResponse.json({ error: problem, code: problem }, { status: 400 }) };
  return { id: typeof body.id === "string" ? body.id : null, draft, error: null };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizePlatformAdmin(request);
  if (auth.error || !auth.adminClient) return auth.error!;
  const recipeId = request.nextUrl.searchParams.get("recipeId") ?? "";
  if (!recipeId) return errorResponse("recipeId is required.", 400);
  return listForRecipe(auth.adminClient, recipeId);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizePlatformAdmin(request);
  if (auth.error || !auth.adminClient) return auth.error!;
  const { draft, error } = await readValidatedDraft(request);
  if (error || !draft) return error!;

  const { data: last } = await auth.adminClient
    .from("chef_challenge_questions")
    .select("display_order")
    .eq("recipe_id", draft.recipeId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = typeof last?.display_order === "number" ? last.display_order + 1 : 0;

  const { error: insertError } = await auth.adminClient.from("chef_challenge_questions").insert({
    recipe_id: draft.recipeId,
    prompt: draft.prompt,
    correct_answer: draft.correctAnswer,
    wrong_answers: draft.wrongAnswers,
    explanation: draft.explanation || null,
    is_active: draft.isActive,
    display_order: nextOrder,
  });
  if (insertError) return errorResponse("Could not save the question.", 500);
  return listForRecipe(auth.adminClient, draft.recipeId);
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizePlatformAdmin(request);
  if (auth.error || !auth.adminClient) return auth.error!;
  const { id, draft, error } = await readValidatedDraft(request);
  if (error || !draft) return error!;
  if (!id) return errorResponse("id is required.", 400);

  const { error: updateError } = await auth.adminClient
    .from("chef_challenge_questions")
    .update({
      prompt: draft.prompt,
      correct_answer: draft.correctAnswer,
      wrong_answers: draft.wrongAnswers,
      explanation: draft.explanation || null,
      is_active: draft.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("recipe_id", draft.recipeId);
  if (updateError) return errorResponse("Could not save the question.", 500);
  return listForRecipe(auth.adminClient, draft.recipeId);
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const auth = await authorizePlatformAdmin(request);
  if (auth.error || !auth.adminClient) return auth.error!;
  const id = request.nextUrl.searchParams.get("id") ?? "";
  const recipeId = request.nextUrl.searchParams.get("recipeId") ?? "";
  if (!id || !recipeId) return errorResponse("id and recipeId are required.", 400);

  const { error: deleteError } = await auth.adminClient
    .from("chef_challenge_questions")
    .delete()
    .eq("id", id)
    .eq("recipe_id", recipeId);
  if (deleteError) return errorResponse("Could not delete the question.", 500);
  return listForRecipe(auth.adminClient, recipeId);
}
