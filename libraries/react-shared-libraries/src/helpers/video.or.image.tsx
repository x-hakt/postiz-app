import { FC } from 'react';
import { clsx } from 'clsx';
import { hasExtension } from '@gitroom/helpers/utils/has.extension';
export const VideoOrImage: FC<{
  src: string;
  autoplay: boolean;
  isContain?: boolean;
  imageClassName?: string;
  videoClassName?: string;
}> = (props) => {
  const { src, autoplay, isContain, imageClassName, videoClassName } = props;
  if (hasExtension(src, 'mp4')) {
    return (
      // x-hakt: controls, so a Reel can be played WITH its sound before scheduling (the operator had no way to
      // hear a draft's audio in Postiz). It still autoplays muted where it autoplays (browsers block autoplay
      // with sound); the controls unmute it. playsInline keeps phones from jumping to fullscreen.
      <video
        src={src}
        autoPlay={autoplay}
        className={clsx('w-full h-full', videoClassName)}
        muted={autoplay}
        loop={true}
        controls={true}
        playsInline={true}
        preload="metadata"
        onClick={(e) => e.stopPropagation()}
      />
    );
  }
  return (
    <img
      className={clsx(
        isContain ? 'object-contain' : 'object-cover',
        'w-full h-full',
        imageClassName
      )}
      src={src}
    />
  );
};
