import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync, unlinkSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface VideoTensorData {
  camera_name: string;
  frames: {
    frame_index: number;
    timestamp: string;
    tensor_data: number[];
    width: number;
    height: number;
    channels: number;
  }[];
  width: number;
  height: number;
  channels: number;
}

// Function to fetch tensor data from URL
async function fetchTensorData(url: string): Promise<VideoTensorData> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch tensor data: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data as VideoTensorData;
  } catch (error) {
    console.error('Error fetching tensor data:', error);
    throw error;
  }
}

// Function to convert tensor data to video using FFmpeg
async function convertTensorToVideo(tensorData: VideoTensorData): Promise<Buffer> {
  const { width, height, channels, frames } = tensorData;
  
  // Create temporary directory for frame files
  const tempDir = join(process.cwd(), 'temp_frames');
  const outputPath = join(process.cwd(), 'temp_video.mp4');
  
  try {
    // Create frame files from tensor data
    for (let frameIndex = 0; frameIndex < frames.length; frameIndex++) {
      const frame = frames[frameIndex];
      const framePath = join(tempDir, `frame_${frameIndex.toString().padStart(6, '0')}.ppm`);
      
      // Create PPM file header
      let ppmContent = `P6\n${width} ${height}\n255\n`;
      
      // Convert tensor data to RGB bytes
      for (let i = 0; i < frame.tensor_data.length; i += channels) {
        const r = Math.max(0, Math.min(255, Math.floor(frame.tensor_data[i] || 0)));
        const g = Math.max(0, Math.min(255, Math.floor(frame.tensor_data[i + 1] || 0)));
        const b = Math.max(0, Math.min(255, Math.floor(frame.tensor_data[i + 2] || 0)));
        
        ppmContent += String.fromCharCode(r, g, b);
      }
      
      writeFileSync(framePath, ppmContent);
    }
    
    // Use FFmpeg to convert frames to MP4
    const ffmpegCommand = `ffmpeg -y -framerate 30 -i ${tempDir}/frame_%06d.ppm -c:v libx264 -pix_fmt yuv420p -crf 23 ${outputPath}`;
    
    await execAsync(ffmpegCommand);
    
    // Read the generated video file
    const videoBuffer = readFileSync(outputPath);
    
    return videoBuffer;
    
  } finally {
    // Clean up temporary files
    try {
      // Remove frame files
      for (let i = 0; i < frames.length; i++) {
        const framePath = join(tempDir, `frame_${i.toString().padStart(6, '0')}.ppm`);
        if (existsSync(framePath)) {
          unlinkSync(framePath);
        }
      }
      
      // Remove output video file
      if (existsSync(outputPath)) {
        unlinkSync(outputPath);
      }
    } catch (cleanupError) {
      console.warn('Cleanup error:', cleanupError);
    }
  }
}

// Generate mock tensor data for testing
function generateMockTensorData(cameraName: string): VideoTensorData {
  const frames = 60; // Reduced for faster processing
  const width = 320;
  const height = 240;
  const channels = 3;
  
  const videoFrames = Array.from({ length: frames }, (_, frameIndex) => {
    const time = frameIndex * 0.1;
    const tensor = new Array(width * height * channels);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * channels;
        const normalizedX = x / width;
        // const normalizedY = y / height; // Removed unused variable
        
        // Generate different patterns based on camera type
        if (cameraName.includes('Front')) {
          // Front camera: Workshop environment
          const r = Math.floor(80 + 40 * Math.sin(normalizedX * 3 + time * 0.2));
          const g = Math.floor(90 + 30 * Math.cos(normalizedX * 2 + time * 0.3));
          const b = Math.floor(100 + 25 * Math.sin(normalizedX * 4 + time * 0.1));
          
          tensor[pixelIndex] = r;
          tensor[pixelIndex + 1] = g;
          tensor[pixelIndex + 2] = b;
        } else {
          // Wrist camera: Close-up view
          const r = Math.floor(120 + 30 * Math.sin(normalizedX * 5 + time * 0.4));
          const g = Math.floor(130 + 25 * Math.cos(normalizedX * 4 + time * 0.3));
          const b = Math.floor(140 + 20 * Math.sin(normalizedX * 6 + time * 0.2));
          
          tensor[pixelIndex] = r;
          tensor[pixelIndex + 1] = g;
          tensor[pixelIndex + 2] = b;
        }
      }
    }
    
    return {
      frame_index: frameIndex,
      timestamp: new Date(Date.now() + frameIndex * 33).toISOString(),
      tensor_data: tensor,
      width,
      height,
      channels
    };
  });
  
  return {
    camera_name: cameraName,
    frames: videoFrames,
    width,
    height,
    channels
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tensor_url, camera_name = 'Front Camera' } = body;
    
    let tensorData: VideoTensorData;
    
    if (tensor_url) {
      // Fetch tensor data from the provided URL
      tensorData = await fetchTensorData(tensor_url);
    } else {
      // Generate mock data for testing
      tensorData = generateMockTensorData(camera_name);
    }
    
    // Convert tensor data to MP4 video
    const videoBuffer = await convertTensorToVideo(tensorData);
    
    // Return the video as MP4
    return new NextResponse(new Uint8Array(videoBuffer), {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': videoBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
    
  } catch (error) {
    console.error('Error processing video request:', error);
    return NextResponse.json(
      { error: 'Failed to convert tensor data to video' },
      { status: 500 }
    );
  }
} 