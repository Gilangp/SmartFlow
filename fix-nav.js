const fs = require('fs');

let code = fs.readFileSync('components/Navigation.tsx', 'utf8');

// Add Lucide imports
if (!code.includes('import {')) {
  code = "import { Home, ClipboardList, Wallet, Tag, TrendingUp, User, LogOut } from 'lucide-react';\n" + code;
} else {
  code = code.replace(/import Link from 'next\/link';/, "import Link from 'next/link';\nimport { Home, ClipboardList, Wallet, Tag, TrendingUp, User, LogOut } from 'lucide-react';");
}

// Replace nav items icons
code = code.replace(/<svg[\\s\\S]*?d=\"M3 12l2-2[\\s\\S]*?<\/svg>/, '<Home className={`w-6 h-6 transition-all duration-200 ${active ? \\'text-indigo-600 dark:text-indigo-400\\' : \\'text-gray-500 dark:text-gray-400\\'}`} strokeWidth={1.8} />');

code = code.replace(/<svg[\\s\\S]*?d=\"M9 5H7a2[\\s\\S]*?<\/svg>/, '<ClipboardList className={`w-6 h-6 transition-all duration-200 ${active ? \\'text-indigo-600 dark:text-indigo-400\\' : \\'text-gray-500 dark:text-gray-400\\'}`} strokeWidth={1.8} />');

code = code.replace(/<svg[\\s\\S]*?d=\"M3 10h18M7[\\s\\S]*?<\/svg>/, '<Wallet className={`w-6 h-6 transition-all duration-200 ${active ? \\'text-indigo-600 dark:text-indigo-400\\' : \\'text-gray-500 dark:text-gray-400\\'}`} strokeWidth={1.8} />');

code = code.replace(/<svg[\\s\\S]*?d=\"M7 7h\\.01[\\s\\S]*?<\/svg>/, '<Tag className={`w-6 h-6 transition-all duration-200 ${active ? \\'text-indigo-600 dark:text-indigo-400\\' : \\'text-gray-500 dark:text-gray-400\\'}`} strokeWidth={1.8} />');

code = code.replace(/<svg[\\s\\S]*?d=\"M13 7h8m0[\\s\\S]*?<\/svg>/, '<TrendingUp className={`w-6 h-6 transition-all duration-200 ${active ? \\'text-indigo-600 dark:text-indigo-400\\' : \\'text-gray-500 dark:text-gray-400\\'}`} strokeWidth={1.8} />');

code = code.replace(/<svg[\\s\\S]*?d=\"M16 7a4[\\s\\S]*?<\/svg>/, '<User className={`w-6 h-6 transition-all duration-200 ${active ? \\'text-indigo-600 dark:text-indigo-400\\' : \\'text-gray-500 dark:text-gray-400\\'}`} strokeWidth={1.8} />');

code = code.replace(/<svg[\\s\\S]*?d=\"M17 16l4-4[\\s\\S]*?<\/svg>/, '<LogOut className=\"w-6 h-6 text-rose-600 dark:text-rose-400\" strokeWidth={1.8} />');

fs.writeFileSync('components/Navigation.tsx', code);
console.log('Navigation.tsx fixed!');
