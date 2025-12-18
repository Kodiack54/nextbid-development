import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

interface BucketStats {
  name: string;
  fileCount: number;
  totalSize: number;
  largestFiles: Array<{ name: string; size: number; path: string }>;
  byType: Record<string, { count: number; size: number }>;
}

/**
 * GET /api/storage-stats
 * Get storage usage statistics across all buckets
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    // List all buckets
    const { data: buckets, error: bucketsError } = await db.storage.listBuckets();

    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
      return NextResponse.json({ error: 'Failed to list buckets' }, { status: 500 });
    }

    const bucketStats: BucketStats[] = [];
    let totalStorage = 0;
    let totalFiles = 0;
    const allLargestFiles: Array<{ name: string; size: number; path: string; bucket: string }> = [];

    // Get stats for each bucket
    for (const bucket of buckets || []) {
      const stats = await getBucketStats(bucket.name, projectId);
      bucketStats.push(stats);
      totalStorage += stats.totalSize;
      totalFiles += stats.fileCount;

      // Collect largest files with bucket info
      stats.largestFiles.forEach(f => {
        allLargestFiles.push({ ...f, bucket: bucket.name });
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

    // Warn if total > 500MB (adjust threshold as needed)
    if (totalStorage > 500 * 1024 * 1024) {
      warnings.push(`Total storage over 500MB`);
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalStorage,
        totalFiles,
        bucketCount: buckets?.length || 0,
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

async function getBucketStats(bucketName: string, projectId: string | null): Promise<BucketStats> {
  const stats: BucketStats = {
    name: bucketName,
    fileCount: 0,
    totalSize: 0,
    largestFiles: [],
    byType: {},
  };

  try {
    // List files recursively
    const allFiles = await listAllFiles(bucketName, projectId || '');

    for (const file of allFiles) {
      if (!file.metadata?.size) continue;

      const size = file.metadata.size;
      stats.fileCount++;
      stats.totalSize += size;

      // Track largest files
      stats.largestFiles.push({
        name: file.name,
        size,
        path: file.path,
      });

      // Categorize by type
      const type = getFileCategory(file.name, file.metadata.mimetype);
      if (!stats.byType[type]) {
        stats.byType[type] = { count: 0, size: 0 };
      }
      stats.byType[type].count++;
      stats.byType[type].size += size;
    }

    // Sort and keep top 5 largest
    stats.largestFiles.sort((a, b) => b.size - a.size);
    stats.largestFiles = stats.largestFiles.slice(0, 5);

  } catch (error) {
    console.error(`Error getting stats for bucket ${bucketName}:`, error);
  }

  return stats;
}

async function listAllFiles(
  bucketName: string,
  path: string,
  allFiles: Array<{ name: string; path: string; metadata: any }> = []
): Promise<Array<{ name: string; path: string; metadata: any }>> {
  const { data: files, error } = await db.storage
    .from(bucketName)
    .list(path, { limit: 1000 });

  if (error || !files) return allFiles;

  for (const file of files) {
    const fullPath = path ? `${path}/${file.name}` : file.name;

    if (file.id === null) {
      // It's a folder, recurse
      await listAllFiles(bucketName, fullPath, allFiles);
    } else {
      // It's a file
      allFiles.push({
        name: file.name,
        path: fullPath,
        metadata: file.metadata,
      });
    }
  }

  return allFiles;
}

function getFileCategory(filename: string, mimetype?: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // Image files
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext) ||
      mimetype?.startsWith('image/')) {
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
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext) ||
      mimetype?.startsWith('video/')) {
    return 'video';
  }

  // Audio
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext) ||
      mimetype?.startsWith('audio/')) {
    return 'audio';
  }

  // Log files
  if (['log'].includes(ext) || filename.includes('.log')) {
    return 'log';
  }

  return 'other';
}
