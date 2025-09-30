import { useEffect, useState } from 'react';

export function useMobileLDPlayer() {
  const [isMobile, setIsMobile] = useState(false);
  const [isLDPlayer, setIsLDPlayer] = useState(false);
  const [screenSize, setScreenSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const checkDevice = () => {
      // Check if running on mobile/tablet
      const mobileCheck = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
      setIsMobile(mobileCheck);

      // Check if running in LDPlayer (Android emulator)
      const ldplayerCheck = /Android/i.test(navigator.userAgent) &&
                           window.innerWidth <= 768;
      setIsLDPlayer(ldplayerCheck);

      // Update screen size
      setScreenSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    checkDevice();

    // Listen for resize events
    const handleResize = () => {
      checkDevice();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    isMobile,
    isLDPlayer,
    screenSize,
    isPortrait: screenSize.width < screenSize.height,
    isTablet: screenSize.width >= 768 && screenSize.width <= 1024
  };
}

// Hook to add mobile-specific styles
export function useMobileStyles() {
  const { isMobile, isLDPlayer } = useMobileLDPlayer();

  useEffect(() => {
    if (isMobile || isLDPlayer) {
      // Add mobile class to body
      document.body.classList.add('mobile-device');

      // Add LDPlayer specific class
      if (isLDPlayer) {
        document.body.classList.add('ldplayer-device');
      }

      // Disable zoom
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content',
          'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'
        );
      }
    }

    return () => {
      document.body.classList.remove('mobile-device', 'ldplayer-device');
    };
  }, [isMobile, isLDPlayer]);

  return { isMobile, isLDPlayer };
}