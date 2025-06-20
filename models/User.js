const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    userType: {
      type: DataTypes.ENUM('trial', 'student'),
      defaultValue: 'trial',
      allowNull: false
    },
    credits: {
      type: DataTypes.INTEGER,
      defaultValue: 3, // 体验用户默认3次
      allowNull: false
    },
    maxCredits: {
      type: DataTypes.INTEGER,
      defaultValue: 3, // 体验用户最大3次
      allowNull: false
    },
    lastCreditReset: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    emailVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    lastLoginAt: {
      type: DataTypes.DATE
    }
  }, {
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          user.password = await bcrypt.hash(user.password, 10);
        }
      }
    }
  });

  // 实例方法
  User.prototype.validatePassword = async function(password) {
    return bcrypt.compare(password, this.password);
  };

  User.prototype.canUseService = function() {
    return this.credits > 0;
  };

  User.prototype.useCredit = async function() {
    if (this.credits > 0) {
      this.credits -= 1;
      await this.save();
      return true;
    }
    return false;
  };

  User.prototype.resetMonthlyCredits = async function() {
    if (this.userType === 'student') {
      this.credits = this.maxCredits;
      this.lastCreditReset = new Date();
      await this.save();
    }
  };

  // 类方法
  User.findByEmailOrUsername = function(identifier) {
    return this.findOne({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { email: identifier },
          { username: identifier }
        ]
      }
    });
  };

  return User;
}; 