import React, { useState } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Share2,
  X,
  Link as LinkIcon,
  Copy,
  CheckCheck,
  Facebook,
  Twitter,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ShareDrawer = ({ postid, shareLink, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const postUrl = postid
    ? `${window.location.origin}/post/${postid}`
    : shareLink;

  const handleShare = async (platform) => {
    const shareUrls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        postUrl,
      )}`,
      twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(
        postUrl,
      )}`,
      whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(
        postUrl,
      )}`,
    };

    if (platform === "copy") {
      try {
        await navigator.clipboard.writeText(postUrl);
        setCopied(true);
        toast.success("Link copied to clipboard!", {
          description: "You can now share it anywhere",
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        toast.error("Failed to copy link");
      }
    } else if (platform === "native") {
      try {
        await navigator.share({
          url: postUrl,
          title: "Check this out!",
        });
        toast.success("Thanks for sharing!");
      } catch (err) {
        if (err.name !== "AbortError") {
          toast.error("Failed to share");
        }
      }
    } else {
      window.open(shareUrls[platform], "_blank", "noopener,noreferrer");
    }
  };

  const platforms = [
    {
      id: "native",
      name: "Share",
      icon: Share2,
      action: () => handleShare("native"),
      className: "bg-gradient-to-r from-blue-500 to-blue-600 text-white",
      showOnMobile: true,
    },
    {
      id: "facebook",
      name: "Facebook",
      icon: Facebook,
      action: () => handleShare("facebook"),
      className: "bg-[#1877F2] text-white",
      showOnMobile: true,
    },
    {
      id: "twitter",
      name: "Twitter",
      icon: Twitter,
      action: () => handleShare("twitter"),
      className: "bg-black text-white dark:bg-white dark:text-black",
      showOnMobile: true,
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      icon: Send,
      action: () => handleShare("whatsapp"),
      className: "bg-[#25D366] text-white",
      showOnMobile: true,
    },
  ];

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="max-h-[90vh]">
        <div className="rounded-t-[1.25rem]">
          <DrawerHeader className="border-b border-gray-200 dark:border-gray-800">
            <DrawerTitle className="flex items-center justify-center gap-2 text-lg font-semibold">
              <Share2 className="w-5 h-5" />
              Share Content
            </DrawerTitle>
            <DrawerClose className="absolute right-4 top-4 hover:bg-gray-100 dark:hover:bg-gray-800 p-1.5 rounded-full transition-all">
              <X className="w-5 h-5" />
            </DrawerClose>
          </DrawerHeader>

          <div className="p-6">
            {/* Link Preview Card */}
            <div className="mb-8 bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">Share Link</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "gap-2 transition-all",
                    copied && "text-green-500",
                  )}
                  onClick={() => handleShare("copy")}
                >
                  {copied ? (
                    <>
                      <CheckCheck className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <div className="w-full bg-white dark:bg-gray-900 rounded-xl p-3 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 break-all">
                {postUrl}
              </div>
            </div>

            {/* Share Platforms Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {platforms.map((platform) => (
                <Button
                  key={platform.id}
                  onClick={platform.action}
                  className={cn(
                    "flex flex-col items-center py-6 gap-2 h-auto transition-transform hover:scale-105 hover:shadow-lg",
                    platform.className,
                    !platform.showOnMobile && "hidden sm:flex",
                  )}
                >
                  <platform.icon className="w-6 h-6" />
                  <span className="text-sm font-medium">{platform.name}</span>
                </Button>
              ))}
            </div>

            {/* Info Section */}
            <div className="mt-8">
              <Separator className="my-4" />
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-current" />
                  All links will open in a new tab for your convenience
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-current" />
                  You can also copy the link to share anywhere else
                </p>
              </div>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ShareDrawer;
