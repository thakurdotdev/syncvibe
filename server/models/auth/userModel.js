const { DataTypes, Model } = require("sequelize");
const sequelize = require("../../utils/sequelize");
const Comment = require("../post/commentModel");
const Chat = require("../chat/chatModel");
const Post = require("../post/postModel");
const Follower = require("./followerModel");
const Story = require("../Story/StoryModal");
const { Authenticator } = require("./passKeyModal");

class User extends Model {}

User.init(
  {
    userid: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    username: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    email: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    bio: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    profilepic: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    logintype: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "EMAILPASSWORD",
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    passkeyEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    lastPasskeyLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    passKeyChallenge: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    challengeExpiry: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "User",
    timestamps: false,
    tableName: "users",
  },
);

const ChatUser = sequelize.define("ChatUser", {
  chatid: {
    type: DataTypes.INTEGER,
    primaryKey: true,
  },
  userid: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: "userid",
    },
  },
});

// Define associations
User.belongsToMany(Chat, { through: ChatUser, foreignKey: "userid" });
Chat.belongsToMany(User, { through: ChatUser, foreignKey: "chatid" });

User.hasMany(Comment, { foreignKey: "createdby", as: "comments" });
Comment.belongsTo(User, { foreignKey: "createdby", as: "user" });

User.hasMany(Post, { foreignKey: "createdby", as: "posts" });
Post.belongsTo(User, { foreignKey: "createdby", as: "user" });

User.hasMany(Story, { foreignKey: "createdby", as: "stories" });
Story.belongsTo(User, { foreignKey: "createdby", as: "user" });

User.hasMany(Authenticator, {
  foreignKey: "userid",
  as: "authenticators",
});

Authenticator.belongsTo(User, {
  foreignKey: "userid",
  as: "user",
});

// Many-to-Many association for generalized use
User.belongsToMany(User, {
  through: Follower,
  as: "followingUsers", // Alias for users being followed
  foreignKey: "followerid",
  otherKey: "followid",
});

User.belongsToMany(User, {
  through: Follower,
  as: "followerUsers", // Alias for users following
  foreignKey: "followid",
  otherKey: "followerid",
});

// Direct associations for more detailed use cases
User.hasMany(Follower, { foreignKey: "followerid", as: "followersList" });
User.hasMany(Follower, { foreignKey: "followid", as: "followingList" });

Follower.belongsTo(User, { foreignKey: "followerid", as: "followerDetail" });
Follower.belongsTo(User, { foreignKey: "followid", as: "followingDetail" });

// User.sync({ alter: true }).then(() => {
//   console.log("User table created");
// });

module.exports = User;
