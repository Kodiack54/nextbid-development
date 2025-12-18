import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Base directory for project files (on server filesystem)
const STORAGE_BASE = process.env.STORAGE_PATH || '/var/www/NextBid_Dev/storage';

interface BucketStats {
  name: string;
  fileCount: number;
  totalSize: number;
  largestFiles: Array<{ name: string; size: number; path: string }>;
  byType: Record<string, { count: number; size: number }>;
}

/**
 * GET /api/storage-stats
 * Get storage usage statistics for local filesystem storage
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    // Check if storage directory exists
    try {
      await fs.access(STORAGE_BASE);
    } catch {
      // Storage directory doesn't exist, create it
      await fs.mkdir(STORAGE_BASE, { recursive: true });
      return NextResponse.json({
        success: true,
        summary: { totalStorage: 0, totalFiles: 0, bucketCount: 0 },
        buckets: [],
        largestFiles: [],
        byType: {},
        warnings: [],
      });
    }

    // List all project directories (buckets)
    const entries = await fs.readdir(STORAGE_BASE, { withFileTypes: true });
    const projectDirs = entries.filter(e => e.isDirectory());

    const bucketStats: BucketStats[] = [];
    let totalStorage = 0;
    let totalFiles = 0;
    const allLargestFiles: Array<{ name: string; size: number; path: string; bucket: string }> = [];

    // Get stats for each project directory
    for (const dir of projectDirs) {
      // If projectId specified, only process that project
      if (projectId && dir.name !== projectId) continue;

      const stats = await getBucketStats(dir.name);
      bucketStats.push(stats);
      totalStorage += stats.totalSize;
      totalFiles += stats.fileCount;

      // Collect largest files with bucket info
      stats.largestFiles.forEach(f => {
        allLargestFiles.push({ ...f, bucket: dir.name });
      });
    }

    // Sort all largest files
    allLargestFiles.sort((a, b) => b.size - a.size);

    // Aggregate by file type across all buckets
    const globalByType: Record<string, { count: number; size: number }> = {};
    for (const stats of bucketStats) {
      for (const [type, data] of Object.entries(stats.byType)) {
        if (!globalByType[type]) {
          globalByType[type] = { count: 0, size: 0 };
        }
        globalByType[type].count += data.count;
        globalByType[type].size += data.size;
      }
    }

    // Check for potential issues
    const warnings: string[] = [];

    // Warn if any single file is > 10MB
    const largeFiles = allLargestFiles.filter(f => f.size > 10 * 1024 * 1024);
    if (largeFiles.length > 0) {
      warnings.push(`${largeFiles.length} files over 10MB`);
    }

    // Warn if images are > 50% of storage
    const imageSize = (globalByType['image']?.size || 0);
    if (totalStorage > 0 && imageSize / totalStorage > 0.5) {
      warnings.push(`Images using ${Math.round(imageSize / totalStorage * 100)}% of storage`);
    }

    // Warn if total > 500MB
    if (totalStorage > 500 * 1024 * 1024) {
      warnings.push(`Total storage over 500MB`);
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalStorage,
        totalFiles,
        bucketCount: projectDirs.length,
      },
      buckets: bucketStats,
      largestFiles: allLargestFiles.slice(0, 10),
      byType: globalByType,
      warnings,
    });
  } catch (error) {
    console.error('Error in storage-stats GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getBucketStats(projectId: string): Promise<BucketStats> {
  const stats: BucketStats = {
    name: projectId,
    fileCount: 0,
    totalSize: 0,
    largestFiles: [],
    byType: {},
  };

  try {
    const allFiles = await listAllFiles(path.join(STORAGE_BASE, projectId), projectId);

    for (const file of allFiles) {
      stats.fileCount++;
      stats.totalSize += file.size;

      // Track largest files
      stats.largestFiles.push({
        name: file.name,
        size: file.size,
        path: file.path,
      });

      // Categorize by type
      const type = getFileCategory(file.name);
      if (!stats.byType[type]) {
        stats.byType[type] = { count: 0, size: 0 };
      }
      stats.byType[type].count++;
      stats.byType[type].size += file.size;
    }

    // Sort and keep top 5 largest
    stats.largestFiles.sort((a, b) => b.size - a.size);
    stats.largestFiles = stats.largestFiles.slice(0, 5);

  } catch (error) {
    console.error(`Error getting stats for project ${projectId}:`, error);
  }

  return stats;
}

async function listAllFiles(
  dirPath: string,
  basePath: string,
  allFiles: Array<{ name: string; path: string; size: number }> = []
): Promise<Array<{ name: string; path: string; size: number }>> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(path.join(STORAGE_BASE, basePath), fullPath);

      if (entry.isDirectory()) {
        await listAllFiles(fullPath, basePath, allFiles);
      } else {
        const fileStat = await fs.stat(fullPath);
        allFiles.push({
          name: entry.name,
          path: `${basePath}/${relativePath}`.replace(/\\/g, '/'),
          size: fileStat.size,
        });
      }
    }
  } catch {
    // Directory might not exist
  }

  return allFiles;
}

function getFileCategory(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // Image files
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext)) {
    return 'image';
  }

  // Document files
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
    return 'document';
  }

  // Text/code files
  if (['md', 'txt', 'json', 'js', 'ts', 'tsx', 'jsx', 'css', 'html', 'sql', 'yaml', 'yml'].includes(ext)) {
    return 'text';
  }

  // Archives
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
    return 'archive';
  }

  // Video
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) {
    return 'video';
  }

  // Audio
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) {
    return 'audio';
  }

  // Log files
  if (['log'].includes(ext) || filename.includes('.log')) {
    return 'log';
  }

  return 'other';
}
