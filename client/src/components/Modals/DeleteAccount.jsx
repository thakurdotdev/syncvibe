import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "../ui/button";
import LoadingScreen from "../Loader";
import { Input } from "../ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Timer } from "lucide-react";

const DeleteAccount = ({ handleLogout, open, setOpen }) => {
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendOTP = async () => {
    try {
      setLoading(true);
      setOtpError("");
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/user/account/delete/otp`,
        {
          withCredentials: true,
        },
      );

      if (response.status === 200) {
        setOtpSent(true);
        setCountdown(60);
        toast.success("OTP has been sent to your registered email.");
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to send OTP. Please try again.",
      );
      setOtpSent(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (otp.length !== 6) {
      setOtpError("Please enter a 6-digit OTP");
      return;
    }

    try {
      setLoading(true);
      setOtpError("");
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/user/delete/account`,
        { otp },
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (response.status === 200) {
        setOpen(false);
        handleLogout();
        toast.success("Your account has been successfully deleted.");
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      const errorMessage =
        error.response?.data?.message ||
        "An error occurred while deleting your account.";
      setOtpError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = () => {
    setOpen(false);
    setOtpSent(false);
    setOtp("");
    setLoading(false);
    setOtpError("");
    setCountdown(0);
  };

  return (
    <LoadingScreen isLoading={loading}>
      <Dialog open={open}>
        <DialogContent closeButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Delete Account
            </DialogTitle>
            <DialogDescription>
              {!otpSent ? (
                <p className="text-center mt-5">
                  Are you sure you want to delete your account? This action
                  cannot be undone. An OTP will be sent to your registered email
                  for verification.
                </p>
              ) : (
                <p className="text-center mt-5">
                  Enter the 6-digit OTP sent to your registered email to confirm
                  account deletion.
                </p>
              )}
            </DialogDescription>
          </DialogHeader>

          {otpSent && (
            <div className="space-y-4 p-5">
              <Input
                type="text"
                placeholder="Enter 6-digit OTP"
                value={otp}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, "");
                  if (value.length <= 6) {
                    setOtp(value);
                    setOtpError("");
                  }
                }}
                className="text-center tracking-widest text-lg"
                maxLength={6}
              />
              {otpError && <p className="text-red-500 text-sm">{otpError}</p>}
              <div className="flex items-center justify-between text-sm">
                <p className="text-muted-foreground">Didn't receive the OTP?</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSendOTP}
                  disabled={countdown > 0}
                  className="flex items-center gap-2"
                >
                  {countdown > 0 ? (
                    <>
                      <Timer className="w-4 h-4" />
                      Resend in {countdown}s
                    </>
                  ) : (
                    "Resend OTP"
                  )}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-center gap-2">
            {!otpSent ? (
              <>
                <Button variant="outline" onClick={handleOpenChange}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleSendOTP}>
                  Send OTP
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleOpenChange}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={otp.length !== 6}
                >
                  Confirm Deletion
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LoadingScreen>
  );
};

export default DeleteAccount;
