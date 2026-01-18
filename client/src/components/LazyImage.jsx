import { LazyLoadImage } from "react-lazy-load-image-component"
import "react-lazy-load-image-component/src/effects/blur.css"

const LazyImage = ({ src, alt, width, height, className }) => {
  return (
    <LazyLoadImage
      effect="blur"
      height={height}
      width={width}
      src={src}
      alt={alt}
      className={className}
      wrapperClassName={className}
      loading="lazy"
      placeholderSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3Crect fill='%23374151' width='1' height='1'/%3E%3C/svg%3E"
    />
  )
}

export default LazyImage
