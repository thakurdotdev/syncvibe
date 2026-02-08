import React from "react"
import { Card } from "./ui/card"
import { Heart } from "lucide-react"
import { MessageCircle } from "lucide-react"

export const PostSkeleton = () => {
  return (
    <Card className="mb-3 overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            {/* Skeleton Avatar */}
            <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse mr-4"></div>

            <div>
              {/* Skeleton Name */}
              <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 animate-pulse mb-2"></div>
              {/* Skeleton Timestamp */}
              <div className="w-24 h-3 bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Skeleton Content */}
        <div className="mb-4">
          <div className="w-full h-6 bg-gray-200 dark:bg-gray-700 animate-pulse mb-2"></div>
          <div className="w-3/4 h-4 bg-gray-200 dark:bg-gray-700 animate-pulse"></div>

          {/* Skeleton Read More Button */}
          <div className="mt-2 w-32 h-4 bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
        </div>

        {/* Skeleton Image Gallery */}
        <div className="my-4 grid gap-1 grid-cols-2">
          {[...Array(2)].map((_, idx) => (
            <div key={idx} className="relative">
              <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg"></div>
              <div className="w-full h-64 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Skeleton Action Buttons */}
      <div className="flex border-t border-gray-200 dark:border-gray-700">
        <div className="flex-1 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition duration-200 flex items-center justify-center dark:text-gray-200">
          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 animate-pulse mr-2"></div>
          <div className="w-10 h-3 bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
        </div>
        <div className="flex-1 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition duration-200 flex items-center justify-center">
          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 animate-pulse mr-2"></div>
          <div className="w-10 h-3 bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
        </div>
        <div className="flex-1 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition duration-200 flex items-center justify-center">
          <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 animate-pulse mr-2"></div>
          <div className="w-10 h-3 bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
        </div>
      </div>
    </Card>
  )
}

export const UserPostSkeleton = () => {
  return (
    <Card className="relative group cursor-pointer rounded-lg overflow-hidden shadow-xs hover:shadow-md transition-shadow duration-300">
      {/* Post Image or Content */}
      <div className="aspect-square w-full overflow-hidden bg-gray-100 dark:bg-gray-700 relative">
        {/* Skeleton for Image */}
        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse relative">
          {/* Skeleton for Image Loading */}
          <div className="w-full h-full bg-gray-300 dark:bg-gray-800 animate-pulse"></div>

          {/* Skeleton for Multiple Image Indicator */}
          <div className="absolute top-3 right-3 bg-gray-300 dark:bg-gray-800 bg-opacity-60 backdrop-blur-xs rounded-full px-3 py-1.5 flex items-center gap-1.5">
            <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
            <div className="w-10 h-3 bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
          </div>
        </div>

        {/* Skeleton for Post Text */}
        <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-700">
          <div className="w-3/4 h-4 bg-gray-300 dark:bg-gray-800 animate-pulse"></div>
        </div>

        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex space-x-6 text-white">
          <div className="flex items-center space-x-2 backdrop-blur-xs bg-black bg-opacity-20 rounded-full px-3 py-1">
            <Heart className="w-5 h-5" color="red" fill="red" />
            <span className="text-sm font-medium">999</span>
          </div>
          <div className="flex items-center space-x-2 backdrop-blur-xs bg-black bg-opacity-20 rounded-full px-3 py-1">
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm font-medium">55</span>
          </div>
        </div>

        {/* Skeleton for Progress Dots for Multiple Images */}
        <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex space-x-1">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="w-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div className="w-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        </div>
      </div>
    </Card>
  )
}
