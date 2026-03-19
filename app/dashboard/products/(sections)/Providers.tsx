"use client";

import type { Product } from "@/app/(interfaces)/product";
import { useAppDispatch } from "@/store/hooks";
import { type ReactNode, useEffect } from "react";
import { setProducts } from "../(redux)/products-slice";

export default function Providers({
  children,
  products,
}: {
  children: ReactNode;
  products: Product[];
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setProducts(products));
  }, [dispatch, products]);

  return <>{children}</>;
}
