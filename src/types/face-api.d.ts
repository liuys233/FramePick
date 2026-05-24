declare module 'face-api.js' {
  export const nets: {
    tinyFaceDetector: {
      loadFromUri: (uri: string) => Promise<void>
    }
    faceLandmark68Net: {
      loadFromUri: (uri: string) => Promise<void>
    }
  }

  export function detectSingleFace(
    input: HTMLImageElement | HTMLVideoElement | string
  ): {
    withFaceLandmarks: () => Promise<{
      detection: { score: number }
      landmarks: {
        getLeftEye(): Array<{ x: number; y: number }>
        getRightEye(): Array<{ x: number; y: number }>
      }
    }>
  }
}