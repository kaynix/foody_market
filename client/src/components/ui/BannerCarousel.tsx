import React, { useState, useEffect } from 'react';
import type { BannerAd } from '../../types';

interface BannerCarouselProps {
  bannerAds: BannerAd[];
  autoAdvanceInterval?: number;
}

const BannerCarousel: React.FC<BannerCarouselProps> = ({ 
  bannerAds, 
  autoAdvanceInterval = 5000 
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto-advance carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % bannerAds.length);
    }, autoAdvanceInterval);
    return () => clearInterval(timer);
  }, [bannerAds.length, autoAdvanceInterval]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % bannerAds.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + bannerAds.length) % bannerAds.length);
  };

  if (bannerAds.length === 0) return null;

  return (
    <div className="relative h-80 overflow-hidden">
      <div 
        className="flex transition-transform duration-500 ease-in-out h-full"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {bannerAds.map((ad) => (
          <div key={ad.id} className="w-full flex-shrink-0 bg-gradient-to-r from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-700 relative">
            <div className="absolute inset-0 bg-white bg-opacity-20 dark:bg-black dark:bg-opacity-30"></div>
            <img 
              src={ad.image} 
              alt={ad.title}
              className="w-full h-full object-cover opacity-40 dark:opacity-30"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-gray-800 dark:text-white">
              <div className="text-center px-6 bg-white bg-opacity-90 dark:bg-gray-800 dark:bg-opacity-90 rounded-lg p-8 shadow-lg">
                <h2 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">{ad.title}</h2>
                <p className="text-base md:text-lg mb-6 max-w-2xl text-gray-700 dark:text-gray-300">{ad.subtitle}</p>
                <button className="btn btn-lg bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white border-none shadow-md">
                  {ad.buttonText}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Navigation Arrows */}
      {bannerAds.length > 1 && (
        <>
          <button 
            onClick={prevSlide}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 btn btn-circle bg-white bg-opacity-70 hover:bg-opacity-90 dark:bg-gray-800 dark:bg-opacity-70 dark:hover:bg-opacity-90 border-none shadow-sm text-gray-500 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button 
            onClick={nextSlide}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 btn btn-circle bg-white bg-opacity-70 hover:bg-opacity-90 dark:bg-gray-800 dark:bg-opacity-70 dark:hover:bg-opacity-90 border-none shadow-sm text-gray-500 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
            {bannerAds.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentSlide 
                    ? 'bg-blue-500 dark:bg-blue-400 shadow-sm' 
                    : 'bg-white bg-opacity-60 hover:bg-opacity-80 dark:bg-gray-600 dark:bg-opacity-60 dark:hover:bg-opacity-80 border border-gray-300 dark:border-gray-500'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default BannerCarousel;
