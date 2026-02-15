import useEmblaCarousel from "embla-carousel-react";
import { useState, useCallback, useEffect } from "react";

interface PostImageCarouselProps {
  images: { media_url: string; order_index: number }[];
}

const PostImageCarousel = ({ images }: PostImageCarouselProps) => {
  const sorted = [...images].sort((a, b) => a.order_index - b.order_index);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  if (sorted.length === 1) {
    return (
      <div className="w-full aspect-square overflow-hidden rounded-lg">
        <img src={sorted[0].media_url} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="overflow-hidden rounded-lg" ref={emblaRef}>
        <div className="flex">
          {sorted.map((img, i) => (
            <div key={i} className="flex-[0_0_100%] min-w-0 aspect-square">
              <img src={img.media_url} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>
      {sorted.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {sorted.map((_, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === selected ? 16 : 6,
                background: i === selected ? "#2BFF88" : "#9CA3AF",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PostImageCarousel;
