/**
 * Auth Feature — Bilingual Strings (EN + ZH)
 *
 * All user-facing copy for the two-layer auth system:
 *   Layer 1: /login (email + password)
 *   Layer 1: /register (family + profiles setup)
 *   Layer 2: /profile-select (profile picker)
 *   Layer 2: /pin-entry (PIN pad)
 *
 * No JSX file in the auth flow may hardcode user-facing strings.
 * Import from this file and key by locale.
 */

export const authStrings = {
  en: {
    // ── Shared ─────────────────────────────────────────────────────────
    shared: {
      appName: 'Chinese Review',
      loading: 'Loading…',
      logout: 'Log out',
      back: '← Back',
    },

    // ── Layer 1: Login (/login) ────────────────────────────────────────
    login: {
      pageTitle: 'Sign in',
      emailLabel: 'Email',
      emailPlaceholder: 'your@email.com',
      passwordLabel: 'Password',
      passwordPlaceholder: '••••••••',
      submitButton: 'Sign in',
      noAccountPrompt: "Don't have an account?",
      registerLink: 'Create one',
      // Errors
      errorInvalidCredentials: 'Incorrect email or password.',
      errorNetworkFailure: 'Could not reach the server. Check your connection.',
      errorUnknown: 'Something went wrong. Please try again.',
    },

    // ── Layer 1: Register (/register) ─────────────────────────────────
    register: {
      pageTitle: 'Create a family account',
      stepFamily: 'Step 1: Family details',
      stepParent: 'Step 2: Your profile',
      stepChild: 'Step 3: Add a child',
      stepDone: "You're all set!",

      familyNameLabel: 'Family name',
      familyNamePlaceholder: 'e.g. The Fu Family',

      emailLabel: 'Email',
      emailPlaceholder: 'your@email.com',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Min 8 characters',
      passwordHint: 'This is your account recovery email. Keep it safe.',

      parentNameLabel: 'Your name',
      parentNamePlaceholder: 'e.g. Mom',
      parentAvatarLabel: 'Choose your avatar',
      parentPinLabel: 'Your PIN (4 digits)',

      childHeading: 'Child profile',
      childNameLabel: "Child's name",
      childNamePlaceholder: 'e.g. Nora',
      childAvatarLabel: "Choose their avatar",
      childPinLabel: "Child's PIN (4 digits)",
      addAnotherChild: 'Add another child',

      submitButton: 'Create account',
      alreadyHaveAccount: 'Already have an account?',
      signInLink: 'Sign in',

      // Validation errors
      errorFamilyNameRequired: 'Family name is required.',
      errorEmailRequired: 'Email is required.',
      errorEmailInvalid: 'Please enter a valid email address.',
      errorPasswordTooShort: 'Password must be at least 8 characters.',
      errorNameRequired: 'Name is required.',
      errorPinRequired: 'PIN is required.',
      errorPinLength: 'PIN must be exactly 4 digits.',
      errorPinNonNumeric: 'PIN must contain only digits.',
      errorAvatarRequired: 'Please choose an avatar.',
      errorAtLeastOneChild: 'Please add at least one child profile.',
      errorEmailAlreadyRegistered: 'An account with this email already exists.',
      errorUnknown: 'Something went wrong. Please try again.',
    },

    // ── Layer 2: Profile select (/profile-select) ──────────────────────
    profileSelect: {
      heading: "Who's learning today?",
      subheading: 'Choose your profile to continue.',
    },

    // ── Layer 2: PIN entry (/pin-entry) ────────────────────────────────
    pinEntry: {
      prompt: 'Enter your PIN',
      backToProfiles: '← Back to profiles',
      loading: 'Verifying…',
      // Errors
      errorWrongPin: 'Wrong PIN. Try again.',
      errorLockedOut: 'Too many attempts. Ask a parent to unlock.',
      errorUnknown: 'Something went wrong. Please try again.',
    },
  },

  zh: {
    // ── Shared ─────────────────────────────────────────────────────────
    shared: {
      appName: '中文复习',
      loading: '加载中…',
      logout: '退出登录',
      back: '← 返回',
    },

    // ── Layer 1: Login (/login) ────────────────────────────────────────
    login: {
      pageTitle: '登录',
      emailLabel: '邮箱',
      emailPlaceholder: 'your@email.com',
      passwordLabel: '密码',
      passwordPlaceholder: '••••••••',
      submitButton: '登录',
      noAccountPrompt: '还没有账号？',
      registerLink: '立即注册',
      // Errors
      errorInvalidCredentials: '邮箱或密码不正确。',
      errorNetworkFailure: '无法连接到服务器，请检查网络。',
      errorUnknown: '出现错误，请重试。',
    },

    // ── Layer 1: Register (/register) ─────────────────────────────────
    register: {
      pageTitle: '创建家庭账号',
      stepFamily: '第一步：家庭信息',
      stepParent: '第二步：你的资料',
      stepChild: '第三步：添加孩子',
      stepDone: '设置完成！',

      familyNameLabel: '家庭名称',
      familyNamePlaceholder: '例如：李家',

      emailLabel: '邮箱',
      emailPlaceholder: 'your@email.com',
      passwordLabel: '密码',
      passwordPlaceholder: '至少8位字符',
      passwordHint: '这是你的账号恢复邮箱，请妥善保管。',

      parentNameLabel: '你的姓名',
      parentNamePlaceholder: '例如：妈妈',
      parentAvatarLabel: '选择你的头像',
      parentPinLabel: '你的PIN（4位数字）',

      childHeading: '孩子的资料',
      childNameLabel: '孩子的姓名',
      childNamePlaceholder: '例如：诺拉',
      childAvatarLabel: '选择他们的头像',
      childPinLabel: '孩子的PIN（4位数字）',
      addAnotherChild: '再添加一个孩子',

      submitButton: '创建账号',
      alreadyHaveAccount: '已有账号？',
      signInLink: '立即登录',

      // Validation errors
      errorFamilyNameRequired: '请输入家庭名称。',
      errorEmailRequired: '请输入邮箱。',
      errorEmailInvalid: '请输入有效的邮箱地址。',
      errorPasswordTooShort: '密码至少需要8位字符。',
      errorNameRequired: '请输入姓名。',
      errorPinRequired: '请输入PIN。',
      errorPinLength: 'PIN必须恰好为4位数字。',
      errorPinNonNumeric: 'PIN只能包含数字。',
      errorAvatarRequired: '请选择一个头像。',
      errorAtLeastOneChild: '请至少添加一个孩子的资料。',
      errorEmailAlreadyRegistered: '该邮箱已注册。',
      errorUnknown: '出现错误，请重试。',
    },

    // ── Layer 2: Profile select (/profile-select) ──────────────────────
    profileSelect: {
      heading: '今天谁来学习？',
      subheading: '选择你的资料以继续。',
    },

    // ── Layer 2: PIN entry (/pin-entry) ────────────────────────────────
    pinEntry: {
      prompt: '请输入PIN',
      backToProfiles: '← 返回选择资料',
      loading: '验证中…',
      // Errors
      errorWrongPin: 'PIN不正确，请重试。',
      errorLockedOut: '尝试次数过多，请让家长解锁。',
      errorUnknown: '出现错误，请重试。',
    },
  },
} as const;

export type AuthStrings = typeof authStrings;
export type AuthLocale = keyof AuthStrings;
