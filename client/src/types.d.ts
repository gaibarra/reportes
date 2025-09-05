// place project-wide type declarations here

declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';

declare interface User {
  pk: number | string;
  username: string;
  email?: string;
  is_superuser?: boolean;
}
