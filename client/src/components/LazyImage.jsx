import { LazyLoadImage } from "react-lazy-load-image-component"
import "react-lazy-load-image-component/src/effects/blur.css"

const LazyImage = ({ src, alt, width, height, classname }) => {
  return (
    <LazyLoadImage
      effect="blur"
      height={height}
      width={width}
      src={src}
      alt={alt}
      className={classname}
      loading="lazy"
    />
  )
}

export default LazyImage
