/**
 * Login Feature — Bilingual Strings (EN + ZH)
 * 
 * All user-facing copy for login, setup wizard, and avatar selection.
 */

export const loginStrings = {
  en: {
    // Page & section titles
    pageTitle: 'Protect Your Learning',
    appName: 'Chinese Review',

    // Setup wizard (first visit)
    setupTitle: 'Create Your Login',
    setupDescription: 'Enter a 4-digit PIN to protect your learning',
    pinLabel: 'Enter 4-digit PIN',
    pinPlaceholder: '••••',
    chooseAvatarLabel: 'Choose your avatar',

    // Avatar labels
    avatarBubbleTea: 'Bubble Tea',
    avatarCake: 'Cake',
    avatarDonut: 'Donut',

    // Login form (returning user)
    loginTitle: 'Welcome Back',
    loginDescription: 'Enter your PIN and choose your avatar',
    enterPinLabel: 'Enter your 4-digit PIN',

    // Buttons
    enterAppButton: 'Enter App',
    submitButton: 'Continue',
    logoutButton: 'Logout',

    // Validation & errors
    pinRequired: 'PIN is required',
    pinLengthError: 'PIN must be exactly 4 digits',
    pinNonNumericError: 'PIN must contain only numbers',
    incorrectPin: 'Incorrect PIN. Please try again.',
    avatarRequired: 'Please select an avatar',

    // Success & navigation
    loggingIn: 'Logging in...',
    redirecting: 'Redirecting...',

    // Help & guidance
    forgotPinHelp: 'If you forgot your PIN, clear your browser cache and create a new one.',
    pinReminder: 'Remember your PIN — you\'ll need it each time you log in.',
    selectAvatarReminder: 'You can change your avatar each time you log in.',
  },

  zh: {
    // Page & section titles
    pageTitle: '保护你的学习数据',
    appName: '中文复习',

    // Setup wizard (first visit)
    setupTitle: '创建你的登录',
    setupDescription: '输入4位数字PIN来保护你的学习数据',
    pinLabel: '输入4位数字PIN',
    pinPlaceholder: '••••',
    chooseAvatarLabel: '选择你的头像',

    // Avatar labels
    avatarBubbleTea: '奶茶',
    avatarCake: '蛋糕',
    avatarDonut: '甜甜圈',

    // Login form (returning user)
    loginTitle: '欢迎回来',
    loginDescription: '输入PIN并选择你的头像',
    enterPinLabel: '输入你的4位数字PIN',

    // Buttons
    enterAppButton: '进入应用',
    submitButton: '继续',
    logoutButton: '登出',

    // Validation & errors
    pinRequired: '需要输入PIN',
    pinLengthError: 'PIN必须恰好为4位数字',
    pinNonNumericError: 'PIN必须仅包含数字',
    incorrectPin: 'PIN不正确。请重试。',
    avatarRequired: '请选择一个头像',

    // Success & navigation
    loggingIn: '登入中...',
    redirecting: '重定向中...',

    // Help & guidance
    forgotPinHelp: '如果你忘记了PIN，请清除浏览器缓存并创建一个新的。',
    pinReminder: '记住你的PIN——每次登录时你都需要它。',
    selectAvatarReminder: '你可以在每次登录时更改你的头像。',
  },
};
