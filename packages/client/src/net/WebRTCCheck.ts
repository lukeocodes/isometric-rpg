/**
 * Tests if the browser supports WebRTC ICE candidate generation.
 * Some privacy-focused browsers (e.g. ungoogled Chromium) block this.
 * Returns true if WebRTC works, false if it's restricted.
 */
export async function checkWebRTCSupport(): Promise<boolean> {
  if (!window.RTCPeerConnection) return false;

  try {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel("test");

    let hasCandidate = false;
    const result = new Promise<boolean>((resolve) => {
      pc.onicecandidate = (e) => {
        if (e.candidate) { hasCandidate = true; resolve(true); }
        else if (!hasCandidate) resolve(false); // null = done, no candidates
      };
      setTimeout(() => resolve(hasCandidate), 1500);
    });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const supported = await result;
    pc.close();
    return supported;
  } catch {
    return false;
  }
}
