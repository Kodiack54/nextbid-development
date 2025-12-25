import { NextResponse } from 'next/server';

const SUSAN_URL = process.env.SUSAN_URL || 'http://localhost:5403';
const CLAIR_URL = process.env.CLAIR_URL || 'http://localhost:5406';

export async function GET() {
  try {
    const [queueRes, categoryRes, todosRes, bugsRes, docsRes] = await Promise.allSettled([
      fetch(`${SUSAN_URL}/api/queue-stats`, { cache: 'no-store' }),
      fetch(`${SUSAN_URL}/api/category-stats`, { cache: 'no-store' }),
      fetch(`${CLAIR_URL}/api/todos/stats`, { cache: 'no-store' }),
      fetch(`${CLAIR_URL}/api/bugs/stats`, { cache: 'no-store' }),
      fetch(`${CLAIR_URL}/api/docs/stats`, { cache: 'no-store' })
    ]);

    const getData = async (result: PromiseSettledResult<Response>) => {
      if (result.status === 'fulfilled' && result.value.ok) {
        return await result.value.json();
      }
      return null;
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      queue: await getData(queueRes) || { pending: { total: 0, byType: {} } },
      knowledge: await getData(categoryRes) || { categories: {}, total: 0 },
      todos: await getData(todosRes) || { total: 0, byStatus: {}, byPriority: {} },
      bugs: await getData(bugsRes) || { total: 0, byStatus: {}, bySeverity: {} },
      docs: await getData(docsRes) || { total: 0, byType: {} }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch stats' }, { status: 500 });
  }
}
