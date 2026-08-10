import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // `_` 前缀 = "我知道它没用到，这是故意的"。代码里有两种正当用法：
      //   - 解构剔除字段：const { receipts: _receipts, ...rest } = tx —— 不把
      //     名字写出来就没法从对象里摘掉它
      //   - 占位参数：为保持函数签名稳定而保留的形参（见 coreCalculations.ts）
      // 不配这条规则的话，这些故意为之的写法会常驻在 lint 输出里，真正有意义的
      // 警告反而被淹掉。
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
];

export default eslintConfig;
