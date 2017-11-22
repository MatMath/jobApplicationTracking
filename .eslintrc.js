module.exports = {
    "extends": ['airbnb-base', "plugin:mocha/recommended"],
    "env": {
        "es6": true,
        "node": true,
        "mocha": true
    },
    "rules":{
      "mocha/no-exclusive-tests": 0,
      "no-plusplus": 0,
      "no-mixed-operators": 0,
      "no-console" : 0,
      "no-use-before-define": 0,
      "no-await-in-loop": 0,
      "max-len": ["error", {
        "code": 200,
        "ignoreComments": true,
        "ignoreTrailingComments": true
      }],
      "no-underscore-dangle": 0
    }
};
