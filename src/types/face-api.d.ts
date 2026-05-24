declare module 'face-api.js' {
  export const nets: any

  export function detectSingleFace(
    imageElement: HTMLImageElement | HTMLVideoElement | string,
    options?: any
  ): {
    withFaceLandmarks: () => Promise<any>
  }
}