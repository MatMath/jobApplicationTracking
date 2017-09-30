module.exports = {
    "extends": "airbnb-base",
    "rules":{
      "mocha/no-exclusive-tests": 0,
      "no-plusplus": 0,
      "no-mixed-operators": 0,
      "no-console" : 0,
      "max-len": ["error", {
        "code": 200,
        "ignoreComments": true,
        "ignoreTrailingComments": true
      }]
    }
};
