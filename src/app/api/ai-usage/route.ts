import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Claude pricing (per 1M tokens)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-3-opus': { input: 15.0, output: 75.0 },
  'claude-3-sonnet': { input: 3.0, output: 15.0 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-3.5-sonnet': { input: 3.0, output: 15.0 },
  'claude-opus-4': { input: 15.0, output: 75.0 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['claude-3-sonnet'];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * GET /api/ai-usage
 * Get AI usage statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const projectId = searchParams.get('project_id');
    const period = searchParams.get('period') || 'month';

    let startDate: Date;
    const now = new Date();

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'all':
        startDate = new Date(2020, 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Query without foreign key joins (relationships may not exist)
    let query = supabase
      .from('dev_ai_usage')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: usage, error } = await query;

    if (error) {
      console.error('Error fetching AI usage:', error);
      return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
    }

    const totals = {
      requests: usage?.length || 0,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      cost_usd: 0,
    };

    const byUser: Record<string, { name: string; requests: number; tokens: number; cost: number }> = {};
    const byProject: Record<string, { name: string; requests: number; tokens: number; cost: number }> = {};
    const byType: Record<string, { requests: number; tokens: number; cost: number }> = {};

    usage?.forEach((row) => {
      totals.input_tokens += row.input_tokens || 0;
      totals.output_tokens += row.output_tokens || 0;
      totals.total_tokens += (row.input_tokens || 0) + (row.output_tokens || 0);
      totals.cost_usd += parseFloat(row.cost_usd) || 0;

      // Group by user (use ID as name since we don't join)
      const userId = row.user_id || 'unknown';
      if (!byUser[userId]) {
        byUser[userId] = { name: userId.slice(0, 8), requests: 0, tokens: 0, cost: 0 };
      }
      byUser[userId].requests++;
      byUser[userId].tokens += (row.input_tokens || 0) + (row.output_tokens || 0);
      byUser[userId].cost += parseFloat(row.cost_usd) || 0;

      // Group by project
      if (row.project_id) {
        if (!byProject[row.project_id]) {
          byProject[row.project_id] = { name: row.project_id.slice(0, 8), requests: 0, tokens: 0, cost: 0 };
        }
        byProject[row.project_id].requests++;
        byProject[row.project_id].tokens += (row.input_tokens || 0) + (row.output_tokens || 0);
        byProject[row.project_id].cost += parseFloat(row.cost_usd) || 0;
      }

      // Group by request type
      const requestType = row.request_type || 'chat';
      if (!byType[requestType]) {
        byType[requestType] = { requests: 0, tokens: 0, cost: 0 };
      }
      byType[requestType].requests++;
      byType[requestType].tokens += (row.input_tokens || 0) + (row.output_tokens || 0);
      byType[requestType].cost += parseFloat(row.cost_usd) || 0;
    });

    const { data: budgets } = await supabase
      .from('dev_ai_budgets')
      .select('*')
      .eq('is_active', true);

    const teamBudget = budgets?.find((b) => !b.user_id)?.monthly_limit_usd || 200;
    const budgetUsedPercent = (totals.cost_usd / teamBudget) * 100;

    return NextResponse.json({
      success: true,
      period,
      totals: {
        ...totals,
        cost_usd: Math.round(totals.cost_usd * 100) / 100,
      },
      budget: {
        monthly_limit: teamBudget,
        used: Math.round(totals.cost_usd * 100) / 100,
        percent_used: Math.round(budgetUsedPercent * 10) / 10,
        remaining: Math.round((teamBudget - totals.cost_usd) * 100) / 100,
      },
      by_user: Object.entries(byUser).map(([id, data]) => ({
        user_id: id,
        ...data,
        cost: Math.round(data.cost * 100) / 100,
      })),
      by_project: Object.entries(byProject).map(([id, data]) => ({
        project_id: id,
        ...data,
        cost: Math.round(data.cost * 100) / 100,
      })),
      by_type: Object.entries(byType).map(([type, data]) => ({
        type,
        ...data,
        cost: Math.round(data.cost * 100) / 100,
      })),
      recent: usage?.slice(0, 20) || [],
    });
  } catch (error) {
    console.error('Error in ai-usage GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/ai-usage
 * Log an AI usage record
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      user_id,
      project_id,
      model,
      input_tokens,
      output_tokens,
      request_type,
      prompt_preview,
      response_time_ms,
    } = body;

    if (!user_id || !model || input_tokens === undefined || output_tokens === undefined) {
      return NextResponse.json(
        { error: 'user_id, model, input_tokens, and output_tokens are required' },
        { status: 400 }
      );
    }

    const cost_usd = calculateCost(model, input_tokens, output_tokens);

    const { data: budgets } = await supabase
      .from('dev_ai_budgets')
      .select('*')
      .eq('is_active', true);

    const teamBudget = budgets?.find((b) => !b.user_id);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: monthUsage } = await supabase
      .from('dev_ai_usage')
      .select('cost_usd')
      .gte('created_at', startOfMonth.toISOString());

    const currentMonthCost = monthUsage?.reduce((sum, row) => sum + parseFloat(row.cost_usd), 0) || 0;
    const newTotalCost = currentMonthCost + cost_usd;

    let warning = null;
    if (teamBudget) {
      const percentUsed = (newTotalCost / teamBudget.monthly_limit_usd) * 100;
      if (percentUsed >= 100 && teamBudget.hard_limit) {
        return NextResponse.json(
          {
            error: 'Monthly AI budget exceeded',
            budget: teamBudget.monthly_limit_usd,
            used: Math.round(newTotalCost * 100) / 100,
          },
          { status: 429 }
        );
      } else if (percentUsed >= teamBudget.warning_threshold_percent) {
        warning = `AI budget at ${Math.round(percentUsed)}% (${Math.round(newTotalCost * 100) / 100} / ${teamBudget.monthly_limit_usd})`;
      }
    }

    const { data: usage, error } = await supabase
      .from('dev_ai_usage')
      .insert({
        user_id,
        project_id,
        model,
        input_tokens,
        output_tokens,
        cost_usd,
        request_type: request_type || 'chat',
        prompt_preview: prompt_preview?.slice(0, 255),
        response_time_ms,
      })
      .select()
      .single();

    if (error) {
      console.error('Error logging AI usage:', error);
      return NextResponse.json({ error: 'Failed to log usage' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      usage,
      cost_usd: Math.round(cost_usd * 1000000) / 1000000,
      warning,
    });
  } catch (error) {
    console.error('Error in ai-usage POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
