import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST() {
  try {
    const { stdout, stderr } = await execAsync('pm2 restart terminal-server');
    return NextResponse.json({ 
      success: true, 
      message: 'Terminal server restarted',
      output: stdout || stderr
    });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
