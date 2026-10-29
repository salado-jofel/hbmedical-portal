/* An account offered by the dev-only account switcher (/dev/login). */
export interface IDevAccount {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
}
