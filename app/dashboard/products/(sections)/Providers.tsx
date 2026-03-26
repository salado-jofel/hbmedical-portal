"use client";

import { useAppDispatch } from "@/store/hooks";
import { type ReactNode, useEffect } from "react";
import { setProducts } from "../(redux)/products-slice";
import { Product } from "@/lib/interfaces/products";

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
