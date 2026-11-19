export type CameraPermissionStatus =
  | 'prompt'
  | 'granted'
  | 'active'
  | 'denied'
  | 'blocked_policy'
  | 'insecure_context'
  | 'unsupported'
  | 'not_found'
  | 'device_busy'
  | 'unknown';

export interface CameraDeviceOption {
  deviceId: string;
  label: string;
}

export interface CameraEnvironmentInfo {
  supported: boolean;
  secureContext: boolean;
  inIframe: boolean;
  iframePolicyBlocked: boolean;
}

interface PolicyDocument extends Document {
  permissionsPolicy?: {
    allowsFeature?: (feature: string) => boolean;
  };
  featurePolicy?: {
    allowsFeature?: (feature: string) => boolean;
  };
}

export function checkCameraEnvironment(): CameraEnvironmentInfo {
  const hasNavigator = typeof navigator !== 'undefined';
  const hasWindow = typeof window !== 'undefined';

  const supported =
    hasNavigator &&
    Boolean(navigator.mediaDevices) &&
    typeof navigator.mediaDevices.getUserMedia === 'function';

  const secureContext = hasWindow ? Boolean(window.isSecureContext) : false;

  let inIframe = false;
  if (hasWindow) {
    try {
      inIframe = window.self !== window.top;
    } catch {
      inIframe = true;
    }
  }

  let iframePolicyBlocked = false;
  if (typeof document !== 'undefined') {
    const policyDoc = document as PolicyDocument;
    try {
      if (policyDoc.permissionsPolicy?.allowsFeature) {
        iframePolicyBlocked = !policyDoc.permissionsPolicy.allowsFeature('camera');
      } else if (policyDoc.featurePolicy?.allowsFeature) {
        iframePolicyBlocked = !policyDoc.featurePolicy.allowsFeature('camera');
      }
    } catch {
      iframePolicyBlocked = false;
    }
  }

  return {
    supported,
    secureContext,
    inIframe,
    iframePolicyBlocked,
  };
}

export async function queryCameraPermissionState(): Promise<CameraPermissionStatus> {
  const env = checkCameraEnvironment();
  if (!env.supported) return 'unsupported';
  if (!env.secureContext) return 'insecure_context';
  if (env.iframePolicyBlocked) return 'blocked_policy';

  if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
    try {
      const result = await navigator.permissions.query({
        name: 'camera' as PermissionName,
      });
      if (result.state === 'granted') return 'granted';
      if (result.state === 'denied') return 'denied';
      if (result.state === 'prompt') return 'prompt';
    } catch {
      // Safari / older Firefox do not support 'camera' in Permissions.query
    }
  }
  return 'prompt';
}

export async function listAvailableCameras(): Promise<CameraDeviceOption[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return [];
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((d) => d.kind === 'videoinput')
      .map((d, idx) => ({
        deviceId: d.deviceId,
        label: d.label?.trim() || `Camera ${idx + 1}`,
      }));
  } catch {
    return [];
  }
}

export interface CameraAcquisitionResult {
  stream: MediaStream | null;
  status: CameraPermissionStatus;
  error: string | null;
  devices: CameraDeviceOption[];
  activeDeviceId: string | null;
}

export function classifyCameraError(
  err: unknown,
  env: CameraEnvironmentInfo
): { status: CameraPermissionStatus; message: string } {
  const name = err instanceof DOMException || err instanceof Error ? err.name : '';
  const rawMessage = err instanceof Error ? err.message : String(err ?? '');

  if (env.iframePolicyBlocked) {
    return {
      status: 'blocked_policy',
      message:
        'Camera access is blocked by the embedded frame Permissions Policy. Open this app in a standalone browser tab or allow camera permissions for the frame, or use "Upload Lot Photo" instead.',
    };
  }

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    if (env.inIframe) {
      return {
        status: 'denied',
        message:
          'Unable to access camera: Permission denied. If you denied the prompt, allow camera access in your browser site settings and click "Retry Camera". If the embedded preview frame restricts camera hardware, open the app in a new tab or use "Upload Lot Photo".',
      };
    }
    return {
      status: 'denied',
      message:
        'Camera permission was denied in your browser. Click the camera/lock icon in the address bar to allow camera access, then click "Retry Camera" (or use "Upload Lot Photo").',
    };
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return {
      status: 'not_found',
      message:
        'No camera device was detected on this system. Connect a webcam, click "Refresh Camera", or use "Upload Lot Photo".',
    };
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return {
      status: 'device_busy',
      message:
        'Your camera appears to be in use by another application or browser tab. Close other video apps and click "Retry Camera".',
    };
  }

  if (name === 'SecurityError') {
    return {
      status: 'insecure_context',
      message:
        'Camera access requires a secure HTTPS context (or localhost). Open the site over HTTPS or use "Upload Lot Photo".',
    };
  }

  if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
    return {
      status: 'not_found',
      message:
        'Selected camera does not support the requested video constraints. Click "Refresh Camera" and choose another camera.',
    };
  }

  return {
    status: 'denied',
    message: rawMessage
      ? `Unable to access camera: ${rawMessage}`
      : 'Unable to access camera. Check browser permissions or use "Upload Lot Photo".',
  };
}

export async function requestCameraStream(options: {
  deviceId?: string;
  facingMode?: 'environment' | 'user';
}): Promise<CameraAcquisitionResult> {
  const env = checkCameraEnvironment();

  if (!env.supported) {
    return {
      stream: null,
      status: 'unsupported',
      error:
        'This browser does not support navigator.mediaDevices.getUserMedia(). Use a modern Chrome, Safari, Edge, or Firefox browser, or use "Upload Lot Photo".',
      devices: [],
      activeDeviceId: null,
    };
  }

  if (!env.secureContext) {
    return {
      stream: null,
      status: 'insecure_context',
      error:
        'Camera access is blocked on insecure origins. Serve this app over HTTPS (or localhost) to enable live camera capture, or use "Upload Lot Photo".',
      devices: [],
      activeDeviceId: null,
    };
  }

  if (env.iframePolicyBlocked) {
    return {
      stream: null,
      status: 'blocked_policy',
      error:
        'Camera access is blocked by the parent iframe Permissions Policy. Open this app in a standalone tab to enable camera capture, or use "Upload Lot Photo".',
      devices: [],
      activeDeviceId: null,
    };
  }

  const preferredVideo: MediaTrackConstraints = options.deviceId
    ? { deviceId: { exact: options.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
    : {
        facingMode: { ideal: options.facingMode ?? 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      };

  let stream: MediaStream | null = null;
  let lastError: unknown = null;

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: preferredVideo, audio: false });
  } catch (err) {
    lastError = err;
    const errName = err instanceof Error ? err.name : '';
    // Retry once with universal fallback constraint if device/resolution constraints failed
    if (errName === 'OverconstrainedError' || errName === 'ConstraintNotSatisfiedError') {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        lastError = null;
      } catch (fallbackErr) {
        lastError = fallbackErr;
      }
    }
  }

  if (!stream) {
    const classified = classifyCameraError(lastError, env);
    const devices = await listAvailableCameras();
    return {
      stream: null,
      status: classified.status,
      error: classified.message,
      devices,
      activeDeviceId: null,
    };
  }

  const devices = await listAvailableCameras();
  const trackSettings = stream.getVideoTracks()[0]?.getSettings?.();
  const activeDeviceId = trackSettings?.deviceId ?? options.deviceId ?? devices[0]?.deviceId ?? null;

  return {
    stream,
    status: 'active',
    error: null,
    devices,
    activeDeviceId,
  };
}

export function stopMediaStream(
  stream: MediaStream | null,
  videoElement?: HTMLVideoElement | null
): void {
  if (stream) {
    for (const track of stream.getTracks()) {
      try {
        track.stop();
      } catch {
        // Ignore already-stopped tracks
      }
    }
  }
  if (videoElement) {
    try {
      videoElement.pause();
      videoElement.srcObject = null;
    } catch {
      // Ignore cleanup failures
    }
  }
}
