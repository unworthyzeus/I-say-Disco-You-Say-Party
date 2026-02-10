/**
 * Face Detection module using face-api.js
 * Detects face regions in images for special treatment in the filter
 */

import * as faceapi from 'face-api.js';
import { FaceRegion } from './disco-filter';

let modelsLoaded = false;

export async function loadFaceDetectionModels(): Promise<void> {
  if (modelsLoaded) return;

  const MODEL_URL = '/models';

  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    ]);
    modelsLoaded = true;
    console.log('Face detection models loaded');
  } catch (err) {
    console.warn('Could not load face detection models:', err);
    // Continue without face detection - the filter still works
  }
}

export async function detectFaces(
  image: HTMLImageElement | HTMLCanvasElement
): Promise<FaceRegion[]> {
  if (!modelsLoaded) {
    console.warn('Face detection models not loaded, skipping face detection');
    return [];
  }

  try {
    const detections = await faceapi.detectAllFaces(
      image as HTMLImageElement,
      new faceapi.TinyFaceDetectorOptions({
        inputSize: 416,
        scoreThreshold: 0.4,
      })
    );

    return detections.map(d => ({
      x: Math.round(d.box.x),
      y: Math.round(d.box.y),
      width: Math.round(d.box.width),
      height: Math.round(d.box.height),
    }));
  } catch (err) {
    console.warn('Face detection failed:', err);
    return [];
  }
}

export function isModelLoaded(): boolean {
  return modelsLoaded;
}
