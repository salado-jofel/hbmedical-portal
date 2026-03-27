"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  buildSignUpFormValues,
  buildProfileInsert,
  buildFacilityInsert,
  formatMessage,
} from "@/utils/helpers/signup";
import { SignUpState } from "@/utils/interfaces/auth";
import {
  validateEmail,
  validatePassword,
  validateRole,
  validatePhone,
  validateCountry,
} from "@/utils/validators/signup";

export async function signUp(
  _prevState: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  let createdUserId: string | null = null;

  try {
    const values = buildSignUpFormValues(formData);

    validateEmail(values.email);
    validatePassword(values.password);
    validateRole(values.role);
    validatePhone(values.phone, "Phone");
    validateCountry(values.facilityCountry);

    const supabase = await createClient();
    const supabaseAdmin = createAdminClient();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          first_name: values.firstName,
          last_name: values.lastName,
          full_name: `${values.firstName} ${values.lastName}`.trim(),
          role: values.role,
          phone: values.phone,
        },
      },
    });

    if (authError) {
      return { error: formatMessage(authError.message) };
    }

    if (!authData.user) {
      return { error: "Failed to create account." };
    }

    createdUserId = authData.user.id;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert(buildProfileInsert(createdUserId, values));

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      return { error: formatMessage(profileError.message) };
    }

    const { error: facilityError } = await supabaseAdmin
      .from("facilities")
      .insert(buildFacilityInsert(createdUserId, values));

    if (facilityError) {
      await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      return { error: formatMessage(facilityError.message) };
    }
  } catch (error) {
    if (createdUserId) {
      try {
        const supabaseAdmin = createAdminClient();
        await supabaseAdmin.auth.admin.deleteUser(createdUserId);
      } catch {
        // noop
      }
    }

    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to create account. Please try again.",
    };
  }

  redirect("/verify-email");
}
