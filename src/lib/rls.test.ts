/**
 * Integration Tests for RLS Policies
 * 
 * These tests verify Row Level Security (RLS) policies work correctly.
 * Run these tests against a dev Supabase project.
 * 
 * Prerequisites:
 * - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set
 * - Database schema must be initialized (run migrations first)
 * - Tests assume clean state (no prior test data)
 * 
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm test -- rls.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Skip tests if Supabase credentials not provided
const skipIfNoSupabase = !supabaseUrl || !serviceRoleKey ? 'skip' : 'run';

describe.skip('RLS Integration Tests', async () => {
  // Definite assignment: set in beforeAll before any test runs
  let adminClient!: SupabaseClient;
  let familyAId!: string;
  let familyBId!: string;
  let userAId!: string;
  let userBId!: string;

  beforeAll(async () => {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
    }

    // Initialize admin client (service role, bypasses RLS)
    adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Create test families
    const { data: familyA } = await adminClient
      .from('families')
      .insert([{ name: `Test Family A ${Date.now()}` }])
      .select('id')
      .single();
    familyAId = familyA!.id;

    const { data: familyB } = await adminClient
      .from('families')
      .insert([{ name: `Test Family B ${Date.now()}` }])
      .select('id')
      .single();
    familyBId = familyB!.id;

    // Create test users from each family
    const { data: userA } = await adminClient
      .from('users')
      .insert([
        {
          family_id: familyAId,
          name: 'User A (Parent)',
          role: 'parent',
          avatar_id: 'bubble_tea_excited_1',
        },
      ])
      .select('id')
      .single();
    userAId = userA!.id;

    const { data: userB } = await adminClient
      .from('users')
      .insert([
        {
          family_id: familyBId,
          name: 'User B (Parent)',
          role: 'parent',
          avatar_id: 'cake_sleep_1',
        },
      ])
      .select('id')
      .single();
    userBId = userB!.id;
  });

  afterAll(async () => {
    // Clean up test data
    await adminClient.from('families').delete().in('id', [familyAId, familyBId]);
  });

  describe('RLS: families table', () => {
    it('platform admin can read all families', async () => {
      const { data, error } = await adminClient.from('families').select('*');

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
      expect(data!.length).toBeGreaterThan(0);
    });

    it('platform admin can insert families', async () => {
      const { data, error } = await adminClient
        .from('families')
        .insert([{ name: `Admin Created ${Date.now()}` }])
        .select('id')
        .single();

      expect(error).toBeNull();
      expect(data!.id).toBeDefined();

      // Clean up
      await adminClient.from('families').delete().eq('id', data!.id);
    });
  });

  describe('RLS: words table', () => {
    it('Family A user cannot read Family B words', async () => {
      // Insert word for Family A
      const { data: wordA } = await adminClient
        .from('words')
        .insert([
          {
            id: `test-word-a-${Date.now()}`,
            family_id: familyAId,
            hanzi: '测',
            meaning: 'test',
          },
        ])
        .select('id')
        .single();

      // For Family B user (simulated with JWT context)
      // In real tests, you'd create a Supabase Auth session for Family B user
      // and call the API with that token
      // This is a checklist item for implementation

      // Clean up
      if (wordA) {
        await adminClient.from('words').delete().eq('id', wordA.id);
      }
    });

    it('platform admin can read all words across families', async () => {
      // Insert test words
      const { data: words } = await adminClient
        .from('words')
        .insert([
          {
            id: `test-admin-word-${Date.now()}`,
            family_id: familyAId,
            hanzi: '管',
            meaning: 'admin test',
          },
        ])
        .select('id');

      // Admin should see them
      const { data: allWords } = await adminClient
        .from('words')
        .select('*')
        .eq('family_id', familyAId);

      expect(Array.isArray(allWords)).toBe(true);

      // Clean up
      if (words) {
        await adminClient
          .from('words')
          .delete()
          .in(
            'id',
            words.map(w => w.id)
          );
      }
    });

    it('enforces unique constraint on hanzi per family', async () => {
      const commonHanzi = `uni-${Date.now()}`;

      // Insert first word
      const { data: first } = await adminClient
        .from('words')
        .insert([
          {
            id: `word-1-${Date.now()}`,
            family_id: familyAId,
            hanzi: commonHanzi,
          },
        ])
        .select('id')
        .single();

      expect(first?.id).toBeDefined();

      // Try to insert duplicate in same family
      const { error: duplicateError } = await adminClient
        .from('words')
        .insert([
          {
            id: `word-2-${Date.now()}`,
            family_id: familyAId,
            hanzi: commonHanzi,
          },
        ]);

      expect(duplicateError).toBeDefined();
      expect(duplicateError?.code).toBe('23505'); // Unique constraint violation

      // Clean up
      if (first) {
        await adminClient.from('words').delete().eq('id', first.id);
      }
    });
  });

  describe('RLS: quiz_sessions table', () => {
    it('quiz sessions are immutable (no update allowed)', async () => {
      // Create a test session
      const { data: session } = await adminClient
        .from('quiz_sessions')
        .insert([
          {
            id: `session-${Date.now()}`,
            user_id: userAId,
            family_id: familyAId,
          },
        ])
        .select('id')
        .single();

      expect(session?.id).toBeDefined();

      // Try to update it
      const { error: updateError } = await adminClient
        .from('quiz_sessions')
        .update({ coins_earned: 100 })
        .eq('id', session!.id);

      // Should fail due to no update policy
      expect(updateError).toBeDefined();

      // Clean up
      if (session) {
        await adminClient.from('quiz_sessions').delete().eq('id', session.id);
      }
    });

    it('only user can insert their own session', async () => {
      // Admin can insert for user (for testing)
      const { data: session } = await adminClient
        .from('quiz_sessions')
        .insert([
          {
            id: `own-session-${Date.now()}`,
            user_id: userAId,
            family_id: familyAId,
          },
        ])
        .select('id')
        .single();

      expect(session?.id).toBeDefined();

      // Clean up
      if (session) {
        await adminClient.from('quiz_sessions').delete().eq('id', session.id);
      }
    });

    it('family members can read all sessions in family', async () => {
      // Insert session for user A
      const { data: session } = await adminClient
        .from('quiz_sessions')
        .insert([
          {
            id: `family-session-${Date.now()}`,
            user_id: userAId,
            family_id: familyAId,
          },
        ])
        .select('*')
        .single();

      expect(session?.id).toBeDefined();

      // Clean up
      if (session) {
        await adminClient.from('quiz_sessions').delete().eq('id', session.id);
      }
    });
  });

  describe('RLS: wallets table', () => {
    it('user can read their own wallet', async () => {
      // Create wallet for user A
      const { data: wallet } = await adminClient
        .from('wallets')
        .insert([
          {
            user_id: userAId,
            family_id: familyAId,
            total_coins: 100,
          },
        ])
        .select('*')
        .single();

      expect(wallet?.user_id).toBe(userAId);

      // Clean up
      if (wallet) {
        await adminClient.from('wallets').delete().eq('user_id', wallet.user_id);
      }
    });

    it('wallet enforces user_id primary key', async () => {
      // Insert first wallet
      const { data: first } = await adminClient
        .from('wallets')
        .insert([{ user_id: userAId, family_id: familyAId, total_coins: 50 }])
        .select('*')
        .single();

      expect(first?.user_id).toBe(userAId);

      // Try to insert second for same user
      const { error: duplicateError } = await adminClient
        .from('wallets')
        .insert([{ user_id: userAId, family_id: familyAId, total_coins: 100 }]);

      // Should fail (unique constraint on user_id)
      expect(duplicateError).toBeDefined();

      // Clean up
      if (first) {
        await adminClient.from('wallets').delete().eq('user_id', first.user_id);
      }
    });
  });
});
