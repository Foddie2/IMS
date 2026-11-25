using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using Ims.Api.Contracts;
using Ims.Api.Domain;

namespace Ims.Api.Tests;

public sealed class AuthAndRbacTests(ApiFactory api) : IClassFixture<ApiFactory>
{
    [Theory]
    [InlineData(ApiFactory.SuperAdmin, "Admin123!", UserRole.SuperAdmin)]
    [InlineData(ApiFactory.Admin, "Manager123!", UserRole.Admin)]
    [InlineData(ApiFactory.User, "Operator123!", UserRole.User)]
    public async Task Seeded_demo_accounts_can_sign_in_and_get_a_jwt_with_their_role(string email, string password, UserRole role)
    {
        var response = await api.CreateClient().PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = (await response.Content.ReadFromJsonAsync<LoginResponse>(ApiFactory.Json))!;
        Assert.Equal(role, body.User.Role);

        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(body.AccessToken);
        Assert.Equal(email, jwt.Claims.Single(c => c.Type == "email").Value);
        Assert.Equal(role.ToString(), jwt.Claims.Single(c => c.Type == "role").Value);
        Assert.Equal(body.User.Id.ToString(), jwt.Subject);
        Assert.False(string.IsNullOrEmpty(jwt.Claims.Single(c => c.Type == "name").Value));
    }

    [Theory]
    [InlineData(ApiFactory.SuperAdmin, "wrong-password")]
    [InlineData("nobody@ims.com", "Admin123!")]
    public async Task Bad_credentials_are_rejected_with_the_same_401(string email, string password)
    {
        var response = await api.CreateClient().PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Contains("Incorrect email or password", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Login_email_is_case_insensitive()
    {
        var response = await api.CreateClient().PostAsJsonAsync("/api/auth/login", new LoginRequest("ADMIN@IMS.com", "Admin123!"));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Me_requires_a_token_and_returns_the_profile()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await api.CreateClient().GetAsync("/api/auth/me")).StatusCode);

        var client = await api.ClientForAsync(ApiFactory.User);
        var me = await client.GetFromJsonAsync<UserDto>("/api/auth/me", ApiFactory.Json);
        Assert.Equal(ApiFactory.User, me!.Email);
        Assert.Equal(2, me.AssignedWarehouseIds.Count);
    }

    [Theory]
    [InlineData("/api/products")]
    [InlineData("/api/inventory")]
    [InlineData("/api/warehouses")]
    [InlineData("/api/reports/inventory-summary")]
    public async Task Data_endpoints_reject_anonymous_callers(string url)
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await api.CreateClient().GetAsync(url)).StatusCode);
    }

    [Fact]
    public async Task Product_writes_follow_the_role_hierarchy()
    {
        var request = new ProductUpsertRequest("TST-RBAC-1", "RBAC Test Product", null, null, 9.99m, "pcs", 5, null, null);

        var user = await api.ClientForAsync(ApiFactory.User);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.PostAsJsonAsync("/api/products", request)).StatusCode);

        var admin = await api.ClientForAsync(ApiFactory.Admin);
        var created = await admin.PostAsJsonAsync("/api/products", request);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var product = (await created.Content.ReadFromJsonAsync<ProductDto>(ApiFactory.Json))!;
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.DeleteAsync($"/api/products/{product.Id}")).StatusCode);

        var superAdmin = await api.ClientForAsync(ApiFactory.SuperAdmin);
        Assert.Equal(HttpStatusCode.NoContent, (await superAdmin.DeleteAsync($"/api/products/{product.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await superAdmin.GetAsync($"/api/products/{product.Id}")).StatusCode);
    }

    [Fact]
    public async Task Duplicate_sku_and_invalid_input_are_rejected()
    {
        var admin = await api.ClientForAsync(ApiFactory.Admin);

        var duplicate = new ProductUpsertRequest("cmp-esp32-s3", "Dup", null, null, 1m, "pcs", 0, null, null);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync("/api/products", duplicate)).StatusCode);

        var invalid = new ProductUpsertRequest("bad sku!", "", null, null, -5m, "pcs", -1, null, null);
        var response = await admin.PostAsJsonAsync("/api/products", invalid);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("Sku", body);
        Assert.Contains("UnitPrice", body);
    }

    [Fact]
    public async Task Users_see_cost_data_only_from_admin_upwards()
    {
        var user = await api.ClientForAsync(ApiFactory.User);
        var userProducts = await user.GetFromJsonAsync<List<ProductDto>>("/api/products", ApiFactory.Json);
        Assert.All(userProducts!, p => Assert.Null(p.UnitPrice));

        var admin = await api.ClientForAsync(ApiFactory.Admin);
        var adminProducts = await admin.GetFromJsonAsync<List<ProductDto>>("/api/products", ApiFactory.Json);
        Assert.All(adminProducts!, p => Assert.NotNull(p.UnitPrice));
    }

    [Fact]
    public async Task Only_super_admins_manage_users_and_the_last_one_cannot_be_demoted()
    {
        var admin = await api.ClientForAsync(ApiFactory.Admin);
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.GetAsync("/api/users")).StatusCode);

        var superAdmin = await api.ClientForAsync(ApiFactory.SuperAdmin);
        var users = await superAdmin.GetFromJsonAsync<List<UserAdminDto>>("/api/users", ApiFactory.Json);
        var self = users!.Single(u => u.Email == ApiFactory.SuperAdmin);

        var demote = await superAdmin.PutAsJsonAsync($"/api/users/{self.Id}",
            new UpdateUserRequest(self.FullName, UserRole.Admin, [], true), ApiFactory.Json);
        Assert.Equal(HttpStatusCode.Conflict, demote.StatusCode);
    }
}
