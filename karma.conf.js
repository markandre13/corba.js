module.exports = (config) => {
  config.set({
    basePath: '.',
    frameworks: ["mocha", "chai", "karma-typescript", "source-map-support"],
    files: [ 
      { pattern: "test/**/*.ts" },
      { pattern: "src/orb/*.ts" }
    ],
    preprocessors: { 
      "**/*.ts": ["karma-typescript"]
    },
    reporters: ["mocha", "karma-typescript"],
    karmaTypescriptConfig: {
      stopOnFailure: false,
      tsconfig: "tsconfig.json",
      bundlerOptions: {
        sourceMap: true
      },
      // we don't need coverage and it breaks sourcemap
      coverageOptions: {
        instrumentation: false,
      },
      compilerOptions: {
        "module": "commonjs",
        "sourceMap": true
      },
      include: [
        "src", "test"
      ]
    },
    port: 9876,
    colors: true,
    browsers: ['ChromeHeadless'],
    autoWatch: false,
    singleRun: true
    // browserNoActivityTimeout: 0
  })
}
