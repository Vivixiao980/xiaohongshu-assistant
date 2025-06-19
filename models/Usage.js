const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Usage = sequelize.define('Usage', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    actionType: {
      type: DataTypes.ENUM('analyze', 'generate'),
      allowNull: false
    },
    model: {
      type: DataTypes.ENUM('claude', 'deepseek'),
      allowNull: false
    },
    inputContent: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    outputContent: {
      type: DataTypes.TEXT
    },
    newTopic: {
      type: DataTypes.STRING(200)
    },
    creditsUsed: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    processingTime: {
      type: DataTypes.INTEGER, // 处理时间（毫秒）
    },
    status: {
      type: DataTypes.ENUM('success', 'error', 'timeout'),
      defaultValue: 'success'
    },
    errorMessage: {
      type: DataTypes.TEXT
    },
    ipAddress: {
      type: DataTypes.STRING(45)
    }
  });

  Usage.associate = (models) => {
    Usage.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return Usage;
}; 