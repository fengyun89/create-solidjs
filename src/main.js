import { program } from "commander";
import inquirer from "inquirer";
import fs from "fs";
import chalk from "chalk";
import pkg from "../package.json" assert { type: "json" };

const res = {};

program.version(pkg.version, "-v, --version", "output the current version");

program.option("-n, --name <name>", "project name");

program.arguments("[name]").action((name) => {
  res.name = name;
});

program.parse();

const options = program.opts();

res.name = res.name || options.name;

const isValidName = (name) => {
  if (typeof name !== "string") return false;
  name = name.trim();
  return name.length > 0;
};

if (!isValidName(res.name)) {
  await inquirer
    .prompt([
      {
        type: "input",
        name: "name",
        default: "solid-project",
        message: "Project name",
        validate: function (input) {
          if (!isValidName(input)) {
            return "Please enter a project name";
          }
          return true;
        },
      },
    ])
    .then((answers) => {
      res.name = answers.name;
    });
}

const files = fs.readdirSync(process.cwd());
if (files.includes(res.name)) {
  await inquirer
    .prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: `Target directory "${res.name}" is not empty. Remove existing files and continue?`,
        default: false,
      },
    ])
    .then((answers) => {
      if (answers.overwrite) {
        fs.rmSync(res.name, { recursive: true });
      } else {
        process.exit(1);
      }
    });
}

await inquirer
  .prompt([
    {
      type: "list",
      name: "case",
      default: "csr",
      message: "Select your use case",
      choices: [
        { name: "Client-side rendering (CSR)", value: "csr" },
        { name: "Server-side rendering (SSR)", value: "ssr", disabled: true },
        { name: "Streaming SSR", value: "sssr", disabled: true },
        { name: "Static site generation (SSG)", value: "ssg", disabled: true },
      ],
    },
  ])
  .then((answers) => {
    res.case = answers.case;
  });

fs.mkdirSync(res.name);

console.log(chalk.green("Done. Now run:\n"));
console.log(chalk.green(`  cd ${res.name}`));
console.log(chalk.green("  npm install"));
console.log(chalk.green("  npm run dev\n"));
