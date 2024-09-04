console.log("Building cli...");
console.log(__dirname);
const data = await Bun.build({
  entrypoints: ["./src/cli.ts"],
  outdir: `${__dirname}/dist`,
});

console.log(data);
