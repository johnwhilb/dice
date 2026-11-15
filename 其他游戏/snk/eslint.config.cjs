const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const unusedImports = require('eslint-plugin-unused-imports');

// 同步 Archer 的 Alloy、TypeScript 和项目规则，保留当前项目的规范例外。
const multilineBlocks = {
    meta: { type: 'layout', fixable: 'whitespace', schema: [], messages: { multiline: '函数和控制流代码块必须换行展开。' } },
    create(context) {
        return {
            BlockStatement(node) {
                if (node.loc.start.line !== node.loc.end.line) {
                    return;
                }
                context.report({
                    node,
                    messageId: 'multiline',
                    fix(fixer) {
                        const source = context.sourceCode;
                        const indent = source.lines[node.loc.start.line - 1].match(/^\s*/)[0];
                        const body = source.getText(node).slice(1, -1).trim();
                        return fixer.replaceText(node, '{\n' + (body ? indent + '    ' + body + '\n' : '') + indent + '}');
                    },
                });
            },
        };
    },
};

module.exports = [
    { ignores: ['node_modules/**', 'temp/**', 'library/**', 'build/**', 'dist/**', '.creator/**', 'extensions/**', 'tools/**', 'assets/SNKRX-master/**', 'assets/script/game/ui/List.ts', 'assets/script/game/ui/ListItem.ts', 'assets/script/game/common/table/Base*.ts', 'assets/script/game/common/table/*Enum.ts', 'assets/script/game/common/table/Enum*.ts'] },
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: { parser: tsParser, ecmaVersion: 'latest', sourceType: 'module', globals: {
    "cc": "readonly",
    "jsb": "readonly",
    "sp": "readonly",
    "CC_DEV": "readonly",
    "CC_EDITOR": "readonly",
    "wx": "readonly",
    "tt": "readonly",
    "canvas": "readonly",
    "qg": "readonly",
    "CC_JSB": "readonly",
    "CC_RUNTIME": "readonly",
    "BigInt": "readonly",
    "console": "readonly",
    "window": "readonly",
    "document": "readonly",
    "navigator": "readonly",
    "location": "readonly",
    "setTimeout": "readonly",
    "clearTimeout": "readonly",
    "setInterval": "readonly",
    "clearInterval": "readonly",
    "Image": "readonly",
    "Event": "readonly",
    "pako": "readonly",
    "JSZip": "readonly",
    "describe": "readonly",
    "it": "readonly",
    "expect": "readonly"
} },
        plugins: { '@typescript-eslint': tseslint, 'unused-imports': unusedImports, project: { rules: { 'multiline-blocks': multilineBlocks } } },
        rules: {
    "accessor-pairs": [
        "error",
        {
            "setWithoutGet": true,
            "getWithoutSet": false
        }
    ],
    "array-callback-return": "error",
    "arrow-body-style": "off",
    "block-scoped-var": "off",
    "camelcase": "off",
    "capitalized-comments": "off",
    "class-methods-use-this": "off",
    "complexity": "off",
    "consistent-return": "off",
    "consistent-this": "off",
    "constructor-super": "error",
    "default-case": "error",
    "default-case-last": "error",
    "default-param-last": "error",
    "dot-notation": "error",
    "eqeqeq": [
        "error",
        "always"
    ],
    "for-direction": "error",
    "func-name-matching": [
        "error",
        "always",
        {
            "includeCommonJSModuleExports": false
        }
    ],
    "func-names": "off",
    "func-style": "off",
    "getter-return": "error",
    "grouped-accessor-pairs": "error",
    "guard-for-in": "off",
    "id-denylist": "off",
    "id-length": "off",
    "id-match": "off",
    "init-declarations": "off",
    "line-comment-position": "off",
    "lines-between-class-members": "off",
    "logical-assignment-operators": "off",
    "max-classes-per-file": "off",
    "max-depth": [
        "error",
        10
    ],
    "max-lines": "off",
    "max-lines-per-function": "off",
    "max-nested-callbacks": [
        "error",
        5
    ],
    "max-params": "off",
    "max-statements": "off",
    "max-statements-per-line": "off",
    "multiline-comment-style": "off",
    "new-cap": [
        "error",
        {
            "newIsCap": true,
            "capIsNew": false,
            "properties": true
        }
    ],
    "no-alert": "off",
    "no-array-constructor": "off",
    "no-async-promise-executor": "error",
    "no-await-in-loop": "off",
    "no-bitwise": "error",
    "no-caller": "error",
    "no-case-declarations": "off",
    "no-class-assign": "error",
    "no-compare-neg-zero": "error",
    "no-cond-assign": [
        "error",
        "except-parens"
    ],
    "no-console": "error",
    "no-const-assign": "error",
    "no-constant-binary-expression": "error",
    "no-constant-condition": [
        "error",
        {
            "checkLoops": false
        }
    ],
    "no-constructor-return": "error",
    "no-continue": "off",
    "no-control-regex": "off",
    "no-debugger": "error",
    "no-delete-var": "off",
    "no-div-regex": "off",
    "no-dupe-args": "off",
    "no-dupe-class-members": "off",
    "no-dupe-else-if": "error",
    "no-dupe-keys": "error",
    "no-duplicate-case": "error",
    "no-duplicate-imports": "off",
    "no-else-return": "off",
    "no-empty": [
        "error",
        {
            "allowEmptyCatch": true
        }
    ],
    "no-empty-character-class": "error",
    "no-empty-function": "off",
    "no-empty-pattern": "error",
    "no-empty-static-block": "off",
    "no-eq-null": "error",
    "no-eval": "error",
    "no-ex-assign": "error",
    "no-extend-native": "off",
    "no-extra-bind": "error",
    "no-extra-boolean-cast": "error",
    "no-extra-label": "off",
    "no-fallthrough": "error",
    "no-func-assign": "error",
    "no-global-assign": "error",
    "no-implicit-coercion": "off",
    "no-implicit-globals": "off",
    "no-implied-eval": "off",
    "no-import-assign": "error",
    "no-inline-comments": "off",
    "no-inner-declarations": [
        "error",
        "both"
    ],
    "no-invalid-regexp": "error",
    "no-invalid-this": "error",
    "no-irregular-whitespace": [
        "error",
        {
            "skipStrings": true,
            "skipComments": false,
            "skipRegExps": true,
            "skipTemplates": true
        }
    ],
    "no-iterator": "error",
    "no-label-var": "off",
    "no-labels": "error",
    "no-lone-blocks": "error",
    "no-lonely-if": "off",
    "no-loop-func": "off",
    "no-loss-of-precision": "error",
    "no-magic-numbers": "off",
    "no-misleading-character-class": "error",
    "no-multi-assign": "off",
    "no-multi-str": "error",
    "no-negated-condition": "off",
    "no-nested-ternary": "off",
    "no-new": "error",
    "no-new-func": "error",
    "no-new-native-nonconstructor": "error",
    "no-object-constructor": "error",
    "no-new-symbol": "error",
    "no-new-wrappers": "error",
    "no-nonoctal-decimal-escape": "off",
    "no-obj-calls": "error",
    "no-octal": "off",
    "no-octal-escape": "off",
    "no-param-reassign": "off",
    "no-plusplus": "off",
    "no-promise-executor-return": "error",
    "no-proto": "error",
    "no-prototype-builtins": "off",
    "no-redeclare": "off",
    "no-regex-spaces": "error",
    "no-restricted-exports": "off",
    "no-restricted-globals": "off",
    "no-restricted-imports": "off",
    "no-restricted-properties": "off",
    "no-restricted-syntax": [
        "error",
        {
            "selector": "TSAsExpression",
            "message": "项目禁止使用 as 类型断言。"
        }
    ],
    "no-return-assign": "error",
    "no-return-await": "off",
    "no-script-url": "off",
    "no-self-assign": "error",
    "no-self-compare": "error",
    "no-sequences": "error",
    "no-setter-return": "error",
    "no-shadow": "off",
    "no-shadow-restricted-names": "error",
    "no-sparse-arrays": "off",
    "no-template-curly-in-string": "error",
    "no-ternary": "off",
    "no-this-before-super": "error",
    "no-throw-literal": "off",
    "no-undef": "off",
    "no-undef-init": "error",
    "no-undefined": "off",
    "no-underscore-dangle": "off",
    "no-unmodified-loop-condition": "error",
    "no-unneeded-ternary": "error",
    "no-unreachable": "error",
    "no-unreachable-loop": "error",
    "no-unsafe-finally": "error",
    "no-unsafe-negation": "error",
    "no-unsafe-optional-chaining": "error",
    "no-unused-expressions": "off",
    "no-unused-labels": "off",
    "no-unused-private-class-members": "error",
    "no-unused-vars": "off",
    "no-use-before-define": "off",
    "no-useless-backreference": "error",
    "no-useless-call": "error",
    "no-useless-catch": "error",
    "no-useless-computed-key": "error",
    "no-useless-concat": "error",
    "no-useless-constructor": "off",
    "no-useless-escape": "off",
    "no-useless-rename": "error",
    "no-useless-return": "off",
    "no-var": "error",
    "no-void": "error",
    "no-warning-comments": "off",
    "no-with": "off",
    "object-shorthand": "error",
    "one-var": [
        "error",
        "never"
    ],
    "operator-assignment": "off",
    "padding-line-between-statements": "off",
    "prefer-arrow-callback": "error",
    "prefer-const": "error",
    "prefer-destructuring": "off",
    "prefer-exponentiation-operator": "off",
    "prefer-named-capture-group": "off",
    "prefer-numeric-literals": "off",
    "prefer-object-has-own": "error",
    "prefer-object-spread": "error",
    "prefer-promise-reject-errors": [
        "error",
        {
            "allowEmptyReject": true
        }
    ],
    "prefer-regex-literals": "off",
    "prefer-rest-params": "off",
    "prefer-spread": "off",
    "prefer-template": "off",
    "radix": "off",
    "require-atomic-updates": "off",
    "require-await": "off",
    "require-unicode-regexp": "off",
    "require-yield": "error",
    "sort-imports": "off",
    "sort-keys": "off",
    "sort-vars": "off",
    "spaced-comment": "error",
    "strict": [
        "error",
        "never"
    ],
    "symbol-description": "error",
    "use-isnan": "error",
    "valid-typeof": "error",
    "vars-on-top": "off",
    "yoda": [
        "error",
        "never",
        {
            "onlyEquality": true
        }
    ],
    "@typescript-eslint/adjacent-overload-signatures": "error",
    "@typescript-eslint/array-type": "off",
    "@typescript-eslint/await-thenable": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/ban-tslint-comment": "off",
    "@typescript-eslint/class-literal-property-style": [
        "error",
        "fields"
    ],
    "@typescript-eslint/consistent-generic-constructors": "off",
    "@typescript-eslint/consistent-indexed-object-style": "off",
    "@typescript-eslint/consistent-type-assertions": [
        "error",
        {
            "assertionStyle": "never"
        }
    ],
    "@typescript-eslint/consistent-type-definitions": [
        "error",
        "interface"
    ],
    "@typescript-eslint/consistent-type-exports": "off",
    "@typescript-eslint/consistent-type-imports": "off",
    "@typescript-eslint/default-param-last": "off",
    "@typescript-eslint/dot-notation": "off",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-member-accessibility": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/init-declarations": "off",
    "@typescript-eslint/member-ordering": "off",
    "@typescript-eslint/method-signature-style": "error",
    "@typescript-eslint/naming-convention": [
        "error",
        {
            "selector": "default",
            "format": [
                "camelCase"
            ]
        },
        {
            "selector": "variable",
            "format": [
                "camelCase"
            ]
        },
        {
            "selector": "typeLike",
            "format": [
                "PascalCase"
            ]
        },
        {
            "selector": "interface",
            "format": [
                "PascalCase"
            ],
            "prefix": [
                "I"
            ]
        },
        {
            "selector": "enumMember",
            "format": [
                "PascalCase"
            ]
        },
        {
            "selector": "classProperty",
            "format": [
                "camelCase",
                "PascalCase"
            ]
        },
        {
            "selector": "classMethod",
            "filter": {
                "regex": "^(btn[A-Z]|__preload$)",
                "match": true
            },
            "format": null
        },
        {
            "selector": "property",
            "modifiers": [
                "requiresQuotes"
            ],
            "format": null
        },
        {
            "selector": "import",
            "format": [
                "camelCase",
                "PascalCase"
            ]
        }
    ],
    "@typescript-eslint/no-array-constructor": "off",
    "@typescript-eslint/no-base-to-string": "off",
    "@typescript-eslint/no-confusing-non-null-assertion": "off",
    "@typescript-eslint/no-confusing-void-expression": "off",
    "@typescript-eslint/no-dupe-class-members": "off",
    "@typescript-eslint/no-duplicate-enum-values": "error",
    "@typescript-eslint/no-dynamic-delete": "off",
    "@typescript-eslint/no-empty-function": "off",
    "@typescript-eslint/no-empty-interface": "error",
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-extra-non-null-assertion": "off",
    "@typescript-eslint/no-extraneous-class": "off",
    "@typescript-eslint/no-floating-promises": "off",
    "@typescript-eslint/no-for-in-array": "off",
    "@typescript-eslint/no-implied-eval": "off",
    "@typescript-eslint/no-inferrable-types": [
        "error",
        {
            "ignoreParameters": true,
            "ignoreProperties": true
        }
    ],
    "@typescript-eslint/no-invalid-void-type": "error",
    "@typescript-eslint/no-loop-func": "off",
    "@typescript-eslint/no-magic-numbers": "off",
    "@typescript-eslint/no-meaningless-void-operator": "off",
    "@typescript-eslint/no-misused-new": "off",
    "@typescript-eslint/no-misused-promises": "off",
    "@typescript-eslint/no-namespace": [
        "error",
        {
            "allowDeclarations": true,
            "allowDefinitionFiles": true
        }
    ],
    "@typescript-eslint/no-non-null-asserted-nullish-coalescing": "error",
    "@typescript-eslint/no-non-null-asserted-optional-chain": "error",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-redeclare": "off",
    "@typescript-eslint/no-redundant-type-constituents": "off",
    "@typescript-eslint/no-require-imports": "error",
    "@typescript-eslint/no-restricted-imports": "off",
    "@typescript-eslint/no-shadow": "off",
    "@typescript-eslint/no-this-alias": "error",
    "@typescript-eslint/no-type-alias": "off",
    "@typescript-eslint/no-unnecessary-boolean-literal-compare": "off",
    "@typescript-eslint/no-unnecessary-condition": "off",
    "@typescript-eslint/no-unnecessary-qualifier": "off",
    "@typescript-eslint/no-unnecessary-type-arguments": "off",
    "@typescript-eslint/no-unnecessary-type-assertion": "off",
    "@typescript-eslint/no-unnecessary-type-constraint": "error",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-declaration-merging": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/no-unused-expressions": [
        "error",
        {
            "allowShortCircuit": true,
            "allowTernary": true,
            "allowTaggedTemplates": true
        }
    ],
    "@typescript-eslint/no-unused-vars": [
        "error",
        {
            "args": "none",
            "ignoreRestSiblings": true
        }
    ],
    "@typescript-eslint/no-use-before-define": "off",
    "@typescript-eslint/no-useless-constructor": "error",
    "@typescript-eslint/no-useless-empty-export": "off",
    "@typescript-eslint/no-var-requires": "off",
    "@typescript-eslint/non-nullable-type-assertion-style": "off",
    "@typescript-eslint/parameter-properties": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/prefer-enum-initializers": "off",
    "@typescript-eslint/prefer-for-of": "error",
    "@typescript-eslint/prefer-function-type": "error",
    "@typescript-eslint/prefer-includes": "off",
    "@typescript-eslint/prefer-literal-enum-member": "off",
    "@typescript-eslint/prefer-namespace-keyword": "error",
    "@typescript-eslint/prefer-nullish-coalescing": "off",
    "@typescript-eslint/prefer-optional-chain": "off",
    "@typescript-eslint/prefer-readonly": "off",
    "@typescript-eslint/prefer-readonly-parameter-types": "off",
    "@typescript-eslint/prefer-reduce-type-parameter": "off",
    "@typescript-eslint/prefer-regexp-exec": "off",
    "@typescript-eslint/prefer-return-this-type": "off",
    "@typescript-eslint/prefer-string-starts-ends-with": "off",
    "@typescript-eslint/prefer-ts-expect-error": "off",
    "@typescript-eslint/promise-function-async": "off",
    "@typescript-eslint/require-array-sort-compare": "off",
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/restrict-plus-operands": "off",
    "@typescript-eslint/restrict-template-expressions": "off",
    "@typescript-eslint/return-await": "off",
    "@typescript-eslint/sort-type-constituents": "off",
    "@typescript-eslint/strict-boolean-expressions": "off",
    "@typescript-eslint/switch-exhaustiveness-check": "off",
    "@typescript-eslint/triple-slash-reference": [
        "error",
        {
            "path": "never",
            "types": "always",
            "lib": "always"
        }
    ],
    "@typescript-eslint/typedef": [
        "error",
        {
            "arrayDestructuring": false,
            "arrowParameter": false,
            "memberVariableDeclaration": true,
            "objectDestructuring": false,
            "parameter": true,
            "propertyDeclaration": true,
            "variableDeclaration": false
        }
    ],
    "@typescript-eslint/unbound-method": "off",
    "@typescript-eslint/unified-signatures": "error",
    "@typescript-eslint/no-empty-object-type": [
        "error",
        {
            "allowObjectTypes": "always",
            "allowInterfaces": "with-single-extends"
        }
    ],
    "unused-imports/no-unused-imports": "error",
    "no-multiple-empty-lines": [
        "error",
        {
            "max": 1,
            "maxBOF": 0,
            "maxEOF": 0
        }
    ],
    "curly": [
        "error",
        "all"
    ],
    "project/multiline-blocks": "error"
},
    },
];
