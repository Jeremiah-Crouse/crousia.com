import React, { Suspense, lazy } from 'react';

const CrousianTextThree = lazy(() => import('./CrousianTextThree'));
const ImageCrousianText = lazy(() => import('./ImageCrousianText'));

export default function CrousianText(props) {
  const useImages = typeof window !== 'undefined' && window.USE_IMAGE_TEXT;
  
  if (useImages) {
    return <ImageCrousianText {...props} />;
  }
  
  return <CrousianTextThree {...props} />;
}
