import { getProfileCloudinaryUrl } from "@/Utils/Cloudinary";
import axios from "axios";
import { LucideX, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "../ui/input";
import { Loader2 } from "lucide-react";

const SearchPost = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const searchUsers = useCallback(async () => {
    if (searchQuery.trim() === "") {
      setUsers([]);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/user/search?name=${searchQuery}`,
        { withCredentials: true },
      );
      setUsers(response.data.users);
    } catch (error) {
      console.error("Error fetching filtered users:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      searchUsers();
    }, 800);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, searchUsers]);

  return (
    <div className="container mx-auto p-6 sm:p-8">
      <div className="flex flex-col items-center gap-6 py-6">
        <h2 className=" text-xl md:text-3xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
          Search Users
        </h2>
        <div className="relative w-full lg:w-1/3">
          <Input
            placeholder="Search for a user..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-full pl-4 pr-10 h-12"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-4 top-1/2 transform -translate-y-1/2"
            >
              <LucideX className="text-gray-500 dark:text-gray-400" />
            </button>
          )}
          {!searchQuery && (
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
              <Search className="text-gray-500 dark:text-gray-400" />
            </div>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        )}

        <div className="w-full gap-3 flex flex-wrap justify-center">
          {users?.map((user) => (
            <div
              onClick={() => {
                navigate(`/user/${user?.username}`, {
                  state: { user },
                });
              }}
              key={user?.userid}
              className="w-[100%] md:w-[30%] flex items-center p-4 rounded-lg cursor-pointer bg-slate-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-700 transition-shadow shadow-md hover:shadow-lg"
            >
              <div className="relative">
                <img
                  src={getProfileCloudinaryUrl(user?.profilepic)}
                  alt={user?.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600"
                />
              </div>
              <div className="flex flex-col ml-4">
                <p className="text-base font-semibold text-gray-800 dark:text-gray-100">
                  {user?.name}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  @{user?.username}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SearchPost;
