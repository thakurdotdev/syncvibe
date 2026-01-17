import React from "react"
import { useState } from "react"
import { ChevronDown } from "lucide-react"

const FilterPosts = ({ onFilterChange }) => {
  const [isOpen, setIsOpen] = useState(false)

  const handleFilterChange = (filterType) => {
    onFilterChange(filterType)
    setIsOpen(false)
  }

  return (
    <div className="flex justify-end items-center mb-6">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center"
        >
          Filter by <ChevronDown className="ml-2" />
        </button>
        {isOpen && (
          <ul className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-lg z-10">
            <li
              className="py-2 px-4 hover:bg-gray-100 cursor-pointer"
              onClick={() => handleFilterChange("date")}
            >
              Date
            </li>
            <li
              className="py-2 px-4 hover:bg-gray-100 cursor-pointer"
              onClick={() => handleFilterChange("popularity")}
            >
              Popularity (Likes)
            </li>
            <li
              className="py-2 px-4 hover:bg-gray-100 cursor-pointer"
              onClick={() => handleFilterChange("comments")}
            >
              Comments
            </li>
          </ul>
        )}
      </div>
    </div>
  )
}

export default FilterPosts
