(function () {
  "use strict";

  const form = document.getElementById("login-form");
  const errorEl = document.getElementById("login-error");
  const loginBtn = document.getElementById("login-btn");
  const patField = document.getElementById("pat-field");
  const passwordField = document.getElementById("password-field");
  const tokenInput = document.getElementById("api-token");
  const passwordInput = document.getElementById("api-password");
  const authHint = document.getElementById("auth-hint");
  const authTypeSelect = document.getElementById("auth-type");
  const providerSelect = document.getElementById("provider");

  const hints = {
    pat: {
      github: "Use a GitHub personal access token with repo read scope.",
      bitbucket: "Use a Bitbucket access token or API token with repository read permission.",
      gitlab: "Use a GitLab personal access token with read_api and read_repository scopes.",
    },
    password: {
      github: "GitHub no longer accepts account passwords for the API. Use PAT mode, or enter your PAT as the password here with Basic auth.",
      bitbucket: "Use your Bitbucket username and app password (recommended) or account password if enabled.",
      gitlab: "Use your GitLab username and account password, or a personal access token as the password.",
    },
  };

  function selectedAuthType() {
    return authTypeSelect.value || "pat";
  }

  function updateAuthFields() {
    const authType = selectedAuthType();
    const provider = providerSelect.value;
    const usePat = authType === "pat";

    patField.hidden = !usePat;
    passwordField.hidden = usePat;
    tokenInput.required = usePat;
    passwordInput.required = !usePat;

    authHint.textContent = (hints[authType] && hints[authType][provider]) || hints.pat.github;
  }

  authTypeSelect.addEventListener("change", updateAuthFields);
  providerSelect.addEventListener("change", updateAuthFields);
  updateAuthFields();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.hidden = true;
    loginBtn.disabled = true;

    const authType = selectedAuthType();
    const payload = {
      user_id: document.getElementById("user-id").value.trim(),
      provider: providerSelect.value,
      auth_type: authType,
      token: authType === "pat" ? tokenInput.value.trim() : "",
      password: authType === "password" ? passwordInput.value : "",
    };

    try {
      const response = await fetch("/git-compare/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Login failed");
      }
      window.location.href = "/git-compare/app";
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
    } finally {
      loginBtn.disabled = false;
    }
  });
})();
