import React from 'react';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowRight, Blocks, Bolt, BookCheck } from 'lucide-react';
import { Icons } from '../icons';

export default function PackageCard({
  title,
  description,
  credits,
  icon,
  subTitle,
  onClick,
  disabled = false,
  class: cardClass,
}) {
  const getClassIcon = () => {
    switch (cardClass) {
      case 'build':
        return <Blocks className="w-6 h-6 mr-2" color="#1C6DAD" />;
      case 'report':
        return <BookCheck className="w-6 h-6 mr-2" color="#1C6DAD" />;
      case 'operations':
        return <Bolt className="w-6 h-6 mr-2" color="#1C6DAD" />;
      default:
        return <Icons.package className="w-6 h-6 mr-2" />;
    }
  };

  const getClassTitle = () => {
    switch (cardClass) {
      case 'build':
        return 'Build & Configuration';
      case 'report':
        return 'Reports';
      case 'operations':
        return 'Maintenance & Troubleshooting';
      case 'package':
        return 'Packages';
      default:
        return 'Packages';
    }
  };

  return (
    <Card
      className={`w-full transition-colors cursor-pointer group relative h-[100%] ${
        disabled
          ? 'opacity-50 pointer-events-none bg-gray-50'
          : 'hover:bg-primary-50 hover:border-primary-200'
      }`}
      onClick={disabled ? undefined : onClick}
    >
      <div className="flex flex-col justify-between h-[100%]">
        <div>
          {disabled && (
            <div className="absolute top-3 right-3 bg-gray-200 text-gray-600 px-2 py-1 rounded-md text-xs font-medium">
              Coming Soon
            </div>
          )}
          <CardHeader className="p-4">
            {icon && (
              <div className="bg-primary-50 flex border border-primary-50 rounded-[8px] p-[8px] group-hover:border-primary-200 mb-2 w-fit mt-2">
                {getClassIcon()} {getClassTitle()}
              </div>
            )}

            <CardTitle className="text-2xl text-primary-800 group-hover:text-primary-700 font-normal">
              {title}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {subTitle && (
              <p className="text-primary-600 text-[14px] mb-2 font-[500]">
                {subTitle}
              </p>
            )}
            <p className="text-gray-600">{description}</p>
          </CardContent>
        </div>
        <CardFooter className="p-4">
          <div className="flex items-center justify-between bg-primary-50 text-primary-600 px-[12px] py-[8px] rounded-[25px] group-hover:rounded-full border border-primary-50 group-hover:border-primary-200 w-full group-hover:w-full transition-all duration-300 ease-in-out">
            <div className="flex items-center gap-2">
              <Icons.toll className="w-6 h-6" />
              <span className="font-medium">{credits} Credits</span>
            </div>
            <ArrowRight className="w-4 h-4 transition-opacity duration-300 ease-in-out opacity-0 group-hover:opacity-100 invisible group-hover:visible" />
          </div>
        </CardFooter>
      </div>
    </Card>
  );
}
