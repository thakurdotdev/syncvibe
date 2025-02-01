const User = require("../../models/auth/userModel");
const getDataUri = require("../../utils/dataUri");
const cloudinary = require("cloudinary").v2;
const Yup = require("yup");
const { Op } = require("sequelize");

const updateProfilePic = async (req, res) => {
  try {
    const { userid } = req.user;

    if (!userid) {
      return res.status(401).send("Unauthorized");
    }

    if (req.user.role === "guest") {
      return res
        .status(403)
        .json({ message: "Guest users cannot update profile picture" });
    }

    const user = await User.findByPk(userid);

    if (!user) {
      return res.status(404).send("User not found");
    }

    if (!req.file) {
      return res.status(400).send("No profile picture provided");
    }

    let profilepic = getDataUri(req.file);
    const cloudinaryResponse = await cloudinary.uploader.upload(
      profilepic.content,
    );

    profilepic = cloudinaryResponse.secure_url;

    // Save the updated user
    const response = await user.update({ profilepic }, { where: { userid } });

    console.log("Profile picture updated successfully", response.profilepic);

    return res.status(200).json({ profilepic: response.profilepic });
  } catch (error) {
    console.error("Error updating profile picture:", error);
    return res.status(500).send("Internal Server Error");
  }
};

// Validation schema for user details
const validationSchema = Yup.object().shape({
  name: Yup.string(),
  username: Yup.string(),
  email: Yup.string().email("Invalid email address"),
  bio: Yup.string(),
});

const updateUserDetails = async (req, res) => {
  try {
    await validationSchema.validate(req.body, { abortEarly: false });

    const { userid } = req.user;

    console.log(req.user);

    if (!userid) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.user.role === "guest") {
      return res
        .status(403)
        .json({ message: "Guest users cannot update user details" });
    }

    const user = await User.findByPk(userid);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, username, email, bio } = req.body;

    if (name) user.name = name;
    if (username) {
      const existingUser = await User.findOne({
        where: { username, userid: { [Op.ne]: userid } },
      });
      if (existingUser && existingUser.id !== userid) {
        return res.status(400).json({ message: "Username already exists" });
      }
      user.username = username;
    }
    if (email) user.email = email;
    if (bio) user.bio = bio;

    // Save the updated user
    await user.save();

    return res
      .status(200)
      .json({ message: "User details updated successfully", user });
  } catch (error) {
    if (error instanceof Yup.ValidationError) {
      return res.status(400).json({ message: error.errors.join(", ") });
    }
    console.error("Error updating user details:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  updateProfilePic,
  updateUserDetails,
};
