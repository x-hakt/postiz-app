'use client';

import { FC } from 'react';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { isUSCitizen } from '@gitroom/frontend/components/launches/helpers/isuscitizen.utils';
dayjs.extend(utc);

export const RenderPreviewDate: FC<{ date: string }> = ({ date }) => {
  return <>{dayjs.utc(date).local().format(isUSCitizen() ? 'MMMM D, YYYY h:mm A' : 'D MMMM YYYY, HH:mm')}</>;
};
