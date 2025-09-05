import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

export default function LazyImage({
  src,
  srcSet,
  alt = '',
  className = '',
  placeholder = '/placeholder-blur.svg',
  style = {},
  width,
  height,
  ...rest
}) {
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if ('loading' in HTMLImageElement.prototype) {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            setInView(true);
            obs.disconnect();
          }
        });
      },
      { rootMargin: '200px' }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const wrapperStyle = {
    position: 'relative',
    overflow: 'hidden',
    display: 'block',
    width: width || '100%',
    height: height || 'auto',
    ...style,
  };

  return (
    <div ref={ref} className={`lazy-image ${className}`} style={wrapperStyle}>
      {placeholder && !loaded && (
        <img
          src={placeholder}
          alt={alt}
          aria-hidden
          style={{
            filter: 'blur(10px)',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'opacity 300ms ease',
            display: 'block',
          }}
        />
      )}

      {inView && (
        <img
          src={src}
          srcSet={srcSet}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 300ms ease',
            display: 'block',
          }}
          {...rest}
        />
      )}
    </div>
  );
}

LazyImage.propTypes = {
  src: PropTypes.string.isRequired,
  srcSet: PropTypes.string,
  alt: PropTypes.string,
  className: PropTypes.string,
  placeholder: PropTypes.string,
  style: PropTypes.object,
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
