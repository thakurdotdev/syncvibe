import React, { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogHeader,
  DialogContent,
  DialogClose,
} from "../ui/dialog";
import LazyImage from "../LazyImage";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import SimpleBar from "simplebar-react";
import "simplebar-react/dist/simplebar.min.css";
import { useNavigate } from "react-router-dom";
import { Button } from "../ui/button";
import { getProfileCloudinaryUrl } from "@/Utils/Cloudinary";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

const Followings = ({ following }) => {
  const navigate = useNavigate();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          disabled={following.length === 0}
          className="px-4 py-2 rounded-full"
          variant="outline"
        >
          {following.length} Following
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>Followings</DialogHeader>

        <SimpleBar style={{ maxHeight: "60vh" }}>
          {following.map((follow) => (
            <DialogTrigger asChild>
              <div
                key={follow?.followingDetail?.userid}
                onClick={() => {
                  navigate(`/user/${follow?.followingDetail?.username}`, {
                    state: { user: follow?.followingDetail },
                  });
                }}
                className="flex items-center p-2 hover:bg-gray-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                <Avatar>
                  <AvatarImage
                    src={getProfileCloudinaryUrl(
                      follow?.followingDetail?.profilepic,
                    )}
                    alt={follow?.followingDetail?.name}
                    className="rounded-full w-12 h-12"
                  />
                  <AvatarFallback>
                    {follow?.followingDetail?.name[0]}
                    {follow?.followingDetail?.name[1]}
                  </AvatarFallback>
                </Avatar>
                <div className="ml-4">
                  {follow?.followingDetail?.name}

                  <p className="text-sm text-neutral-500">
                    @{follow?.followingDetail?.username}
                  </p>
                </div>
              </div>
            </DialogTrigger>
          ))}
        </SimpleBar>
      </DialogContent>
    </Dialog>
  );
};

export default Followings;
